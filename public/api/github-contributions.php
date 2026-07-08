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

$source = $token !== '' ? ($owner !== '' ? 'public' : 'viewer') : 'none';
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
function fallback(string $cacheFile, array $empty): string {
    if (is_file($cacheFile)) {
        $stale = file_get_contents($cacheFile);
        if ($stale !== false && $stale !== '') {
            return $stale;
        }
    }
    return json_encode($empty, JSON_UNESCAPED_SLASHES);
}

if ($token === '') {
    echo json_encode($empty, JSON_UNESCAPED_SLASHES);
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
    echo fallback($cacheFile, $empty);
    exit;
}

$data = json_decode($body, true);
$calendar = $data['data']['user']['contributionsCollection']['contributionCalendar']
    ?? $data['data']['viewer']['contributionsCollection']['contributionCalendar']
    ?? null;

if (!is_array($calendar) || !isset($calendar['weeks']) || !is_array($calendar['weeks'])) {
    echo fallback($cacheFile, $empty);
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
];

$json = json_encode($response, JSON_UNESCAPED_SLASHES);
if (!empty($weeks)) {
    @file_put_contents($cacheFile, $json, LOCK_EX);
}

echo $json;
