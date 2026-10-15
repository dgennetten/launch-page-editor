<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$configPath = __DIR__ . '/config.php';
$localConfigPath = __DIR__ . '/config.local.php';
$config = [];

// config.local.php is server-only (never deployed), for preserving GitHub tokens
// across redeploys. It takes precedence over the generated config.php.
if (is_file($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        $config = $loaded;
    }
} elseif (is_file($configPath)) {
    $loaded = require $configPath;
    if (is_array($loaded)) {
        $config = $loaded;
    }
}

$token = getenv('GITHUB_TOKEN') ?: ($config['github_token'] ?? '');
$owner = getenv('GITHUB_OWNER') ?: ($config['github_owner'] ?? '');

$source = $token !== '' ? ($owner !== '' ? 'public' : 'private') : 'none';
$empty = ['weeks' => [], 'total' => 0, 'source' => $source];

// The GraphQL contribution calendar is one request but still worth caching, to
// keep the page fast and stay well under API limits.
$cacheFile = dirname(__DIR__) . '/data/github-contributions-cache.json';
$cacheTtl = 6 * 3600;

if (is_file($cacheFile) && time() - filemtime($cacheFile) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false && $cached !== '') {
        echo $cached;
        exit;
    }
}

/** Return any cached copy (even stale) or the empty payload. */
function fallback(string $cacheFile, array $empty, string $reason = ''): string {
    if (is_file($cacheFile)) {
        $stale = file_get_contents($cacheFile);
        if ($stale !== false && $stale !== '') {
            $data = json_decode($stale, true);
            if (is_array($data)) {
                $cacheAge = time() - filemtime($cacheFile);
                $data['stale'] = true;
                $data['stale_reason'] = $reason ?: 'unknown';
                $data['cache_age_seconds'] = $cacheAge;
                $data['cached_at'] = filemtime($cacheFile);
                return json_encode($data, JSON_UNESCAPED_SLASHES);
            }
            return $stale;
        }
    }
    $empty['stale'] = false;
    return json_encode($empty, JSON_UNESCAPED_SLASHES);
}

if ($token === '') {
    // Still serve a stale cache if we have one — a deploy that wiped
    // github_token from config.php should not blank the heatmap.
    echo fallback($cacheFile, $empty, 'no_token');
    exit;
}

$calendarFields = 'contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}';
if ($owner !== '') {
    $query = 'query($login:String!){user(login:$login){' . $calendarFields . '}}';
    $variables = ['login' => $owner];
} else {
    $query = 'query{viewer{' . $calendarFields . '}}';
    $variables = new stdClass();
}

$context = stream_context_create(['http' => [
    'method' => 'POST',
    'header' => implode("\r\n", [
        'Content-Type: application/json',
        'Accept: application/vnd.github+json',
        'User-Agent: launch-page-editor',
        'Authorization: Bearer ' . $token,
    ]),
    'content' => json_encode(['query' => $query, 'variables' => $variables]),
    'timeout' => 30,
    'ignore_errors' => true,
]]);

$body = @file_get_contents('https://api.github.com/graphql', false, $context);
if ($body === false) {
    echo fallback($cacheFile, $empty, 'request_failed');
    exit;
}

$data = json_decode($body, true);

// Check for auth errors.
if (isset($data['errors']) && is_array($data['errors'])) {
    foreach ($data['errors'] as $error) {
        if (isset($error['type']) && ($error['type'] === 'FORBIDDEN' || $error['type'] === 'UNAUTHORIZED')) {
            echo fallback($cacheFile, $empty, 'auth_failed');
            exit;
        }
    }
}

$calendar = $data['data']['user']['contributionsCollection']['contributionCalendar']
    ?? $data['data']['viewer']['contributionsCollection']['contributionCalendar']
    ?? null;

if (!is_array($calendar) || !isset($calendar['weeks']) || !is_array($calendar['weeks'])) {
    echo fallback($cacheFile, $empty, 'invalid_response');
    exit;
}

$levelMap = [
    'NONE' => 0,
    'FIRST_QUARTILE' => 1,
    'SECOND_QUARTILE' => 2,
    'THIRD_QUARTILE' => 3,
    'FOURTH_QUARTILE' => 4,
];

$weeks = [];
foreach ($calendar['weeks'] as $week) {
    if (!isset($week['contributionDays']) || !is_array($week['contributionDays'])) {
        continue;
    }
    $days = [];
    foreach ($week['contributionDays'] as $day) {
        $days[] = [
            'date' => (string) ($day['date'] ?? ''),
            'count' => (int) ($day['contributionCount'] ?? 0),
            'level' => $levelMap[$day['contributionLevel'] ?? 'NONE'] ?? 0,
            'weekday' => (int) ($day['weekday'] ?? 0),
        ];
    }
    $weeks[] = $days;
}

$response = [
    'weeks' => $weeks,
    'total' => (int) ($calendar['totalContributions'] ?? 0),
    'source' => $source,
    'fetched_at' => time(),
    'stale' => false,
];

$json = json_encode($response, JSON_UNESCAPED_SLASHES);
if (!empty($weeks)) {
    @file_put_contents($cacheFile, $json, LOCK_EX);
}

echo $json;
