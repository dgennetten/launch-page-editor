<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    echo json_encode(['error' => 'Publish is not configured on this server.']);
    exit;
}

/** @var array{password?: string} $config */
$config = require $configPath;
$expected = $config['password'] ?? '';
if ($expected === '') {
    http_response_code(503);
    echo json_encode(['error' => 'Publish password is not configured.']);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty request body']);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$password = $payload['password'] ?? '';
if (!is_string($password) || !hash_equals($expected, $password)) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect password']);
    exit;
}

$data = $payload['data'] ?? null;
if (!is_array($data) || !isset($data['site'], $data['cards']) || !is_array($data['cards'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid cards data']);
    exit;
}

foreach ($data['cards'] as $card) {
    if (!is_array($card) || !isset($card['url']) || !is_string($card['url'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Each card must include a url']);
        exit;
    }
    if (!preg_match('#^https?://#i', $card['url'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Only http(s) card URLs are allowed']);
        exit;
    }
}

$json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to encode JSON']);
    exit;
}

$targetDir = dirname(__DIR__) . '/data';
$target = $targetDir . '/cards.json';

if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not create data directory']);
    exit;
}

$tmp = $target . '.tmp';
if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not write cards file']);
    exit;
}

if (!rename($tmp, $target)) {
    @unlink($tmp);
    http_response_code(500);
    echo json_encode(['error' => 'Could not finalize cards file']);
    exit;
}

@chmod($target, 0644);
@chmod($targetDir, 0755);

echo json_encode(['ok' => true]);
