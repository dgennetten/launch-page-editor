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
    $weekly = array_fill(0, 52, 0);
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
        $entries = array_values($data);
        $slice = array_slice($entries, -52);

        foreach ($slice as $index => $entry) {
            if (!is_array($entry) || count($entry) < 2) {
                continue;
            }
            $weekly[$index] += (int) ($entry[1] ?? 0);
        }
    }

    return ['values' => $weekly, 'repositories' => $repoCount];
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
    'source' => $token !== '' ? 'private' : ($owner !== '' ? 'public' : 'none'),
];

echo json_encode($response, JSON_UNESCAPED_SLASHES);
