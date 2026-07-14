<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$configPath = __DIR__ . '/config.php';
$config = [];
if (is_file($configPath)) {
    $loaded = require $configPath;
    if (is_array($loaded)) {
        $config = $loaded;
    }
}

$token = getenv('GITHUB_TOKEN') ?: ($config['github_token'] ?? '');
$owner = getenv('GITHUB_OWNER') ?: ($config['github_owner'] ?? '');

// Aggregating code_frequency across every repo takes ~15-20s (one GitHub call
// per repo), so cache the aggregated result to disk and serve it for a while.
// This keeps the chart fast and avoids re-hitting the API on every page load.
$cacheFile = dirname(__DIR__) . '/data/github-stats-cache.json';
$cacheTtl = 6 * 3600;

if (is_file($cacheFile) && time() - filemtime($cacheFile) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false && $cached !== '') {
        $cachedData = json_decode($cached, true);
        $cacheSource = is_array($cachedData) ? ($cachedData['source'] ?? '') : '';
        // A no-token deploy can poison the cache with public-only data. If we
        // now have a token, skip that cache and rebuild with private repos.
        if (!($token !== '' && $cacheSource === 'public')) {
            echo $cached;
            exit;
        }
    }
}

function githubRequest(string $url, string $token): array {
    $headers = [
        'Accept: application/vnd.github+json',
        'User-Agent: launch-page-editor',
    ];

    if ($token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $headers),
            'timeout' => 30,
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        return ['ok' => false, 'status' => 0, 'body' => ''];
    }

    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $line) {
            if (preg_match('#^HTTP/\d\.\d\s+(\d{3})#i', $line, $matches)) {
                $status = (int) $matches[1];
                break;
            }
        }
    }

    return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => $body];
}

function githubStatsWithRetry(string $url, string $token): array {
    $attempts = 0;
    while ($attempts < 3) {
        $attempts++;
        $response = githubRequest($url, $token);
        if ($response['status'] === 202) {
            usleep(1500000);
            continue;
        }
        return $response;
    }

    return githubRequest($url, $token);
}

function aggregateWeeklyAdditions(array $statsResponses): array {
    // Align by week timestamp, not array index. Repos with <52 weeks of history
    // would otherwise left-pad into the start of the chart and leave recent
    // weeks looking empty.
    $byWeek = [];
    $repoCount = 0;

    foreach ($statsResponses as $response) {
        if (!$response['ok']) {
            continue;
        }

        $data = json_decode($response['body'], true);
        if (!is_array($data)) {
            continue;
        }

        $repoCount++;
        foreach ($data as $entry) {
            if (!is_array($entry) || count($entry) < 2) {
                continue;
            }
            $ts = (int) ($entry[0] ?? 0);
            if ($ts <= 0) {
                continue;
            }
            $byWeek[$ts] = ($byWeek[$ts] ?? 0) + (int) ($entry[1] ?? 0);
        }
    }

    if ($repoCount === 0 || empty($byWeek)) {
        return ['values' => array_fill(0, 52, 0), 'repositories' => $repoCount, 'end' => 0];
    }

    $latest = max(array_keys($byWeek));
    $weekSeconds = 7 * 86400;
    $weekly = [];
    for ($i = 51; $i >= 0; $i--) {
        $ts = $latest - ($i * $weekSeconds);
        $weekly[] = $byWeek[$ts] ?? 0;
    }

    return ['values' => $weekly, 'repositories' => $repoCount, 'end' => $latest];
}

$repos = [];
if ($token !== '') {
    $reposResponse = githubRequest('https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc', $token);
    if ($reposResponse['ok']) {
        $payload = json_decode($reposResponse['body'], true);
        if (is_array($payload)) {
            $repos = $payload;
        }
    }
} elseif ($owner !== '') {
    $reposResponse = githubRequest('https://api.github.com/users/' . rawurlencode($owner) . '/repos?per_page=100&sort=updated&direction=desc', $token);
    if ($reposResponse['ok']) {
        $payload = json_decode($reposResponse['body'], true);
        if (is_array($payload)) {
            $repos = $payload;
        }
    }
}

$statsResponses = [];
foreach ($repos as $repo) {
    if (!is_array($repo)) {
        continue;
    }
    $fullName = $repo['full_name'] ?? '';
    if ($fullName === '') {
        continue;
    }
    // Encode each path segment but keep the owner/repo slash — rawurlencode on
    // the whole "owner/repo" turns the slash into %2F, which GitHub 404s.
    $encodedName = implode('/', array_map('rawurlencode', explode('/', $fullName)));
    $statsResponse = githubStatsWithRetry('https://api.github.com/repos/' . $encodedName . '/stats/code_frequency', $token);
    $statsResponses[] = $statsResponse;
}

$aggregation = aggregateWeeklyAdditions($statsResponses);

$response = [
    'values' => $aggregation['values'],
    'repositories' => $aggregation['repositories'],
    'end' => $aggregation['end'] ?? 0,
    'source' => $token !== '' ? 'private' : ($owner !== '' ? 'public' : 'none'),
];

$json = json_encode($response, JSON_UNESCAPED_SLASHES);

// Only cache a result that actually has data, so a transient GitHub failure
// doesn't poison the cache with zeros. If this run produced nothing, fall back
// to any stale cached copy before giving up.
if ($aggregation['repositories'] > 0) {
    @file_put_contents($cacheFile, $json, LOCK_EX);
} elseif (is_file($cacheFile)) {
    $stale = file_get_contents($cacheFile);
    if ($stale !== false && $stale !== '') {
        echo $stale;
        exit;
    }
}

echo $json;
