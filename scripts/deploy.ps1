#Requires -Version 5.1
<#
.SYNOPSIS
  Build and deploy the launch page to a remote server over SSH/SCP.

.CONFIGURATION
  1. Copy deploy.config.example.json to deploy.config.json
  2. Copy .env.example to .env and set VITE_ADMIN_PASSWORD
  3. Run: npm run deploy

  Optional env overrides: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH, DEPLOY_PORT, DEPLOY_SSH_KEY, GITHUB_TOKEN, GITHUB_OWNER
#>
param(
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    $vars = @{}
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
        $vars[$key] = $value
    }
    return $vars
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name. Install OpenSSH client or add it to PATH."
    }
}

# Native commands don't trip $ErrorActionPreference; check their exit code so a
# failed build or upload aborts instead of silently reporting success.
function Assert-LastExit {
    param([string]$What)
    if ($LASTEXITCODE -ne 0) {
        throw "$What failed (exit $LASTEXITCODE). Deploy aborted."
    }
}

# Guard against a stale Node (e.g. an old nvm default shadowing the system one),
# which crashes the Vite build partway through.
function Assert-NodeVersion {
    $version = (& node -v) 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $version) {
        throw 'node was not found on PATH.'
    }
    $major = 0
    if ($version -match '^v(\d+)\.') { $major = [int]$Matches[1] }
    if ($major -lt 18) {
        throw "Node $version is too old to build (need >= 18). If you use nvm, run 'nvm use' to select a modern Node before deploying."
    }
    Write-Host "Using Node $version"
}

$configPath = Join-Path $Root 'deploy.config.json'
if (-not (Test-Path $configPath)) {
    throw "Missing deploy.config.json. Copy deploy.config.example.json and edit it."
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$envFile = Read-DotEnv (Join-Path $Root '.env')

$hostName = if ($env:DEPLOY_HOST) { $env:DEPLOY_HOST } else { $config.host }
$user = if ($env:DEPLOY_USER) { $env:DEPLOY_USER } else { $config.user }
$remotePath = if ($env:DEPLOY_PATH) { $env:DEPLOY_PATH } else { $config.path }
$port = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } else { $config.port }
$sshKey = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { $config.sshKey }
$reloadNginx = if ($null -ne $config.reloadNginx) { [bool]$config.reloadNginx } else { $true }

if (-not $hostName -or -not $user -or -not $remotePath) {
    throw 'Deploy target incomplete. Set host, user, and path in deploy.config.json.'
}

$adminPassword = $envFile['VITE_ADMIN_PASSWORD']
if (-not $adminPassword -or $adminPassword -eq 'change-me-to-a-strong-password') {
    throw 'Set a real VITE_ADMIN_PASSWORD in .env before deploying.'
}

$githubToken = if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { $config.githubToken }
$githubOwner = if ($env:GITHUB_OWNER) { $env:GITHUB_OWNER } else { $config.githubOwner }

Require-Command ssh
Require-Command scp
Require-Command tar

$sshTarget = "${user}@${hostName}"
$sshArgs = @('-p', "$port")
$scpArgs = @('-P', "$port", '-r')
if ($sshKey) {
    $sshArgs += @('-i', $sshKey)
    $scpArgs += @('-i', $sshKey)
}

Write-Host "Deploy target: $sshTarget`:$remotePath"

# A deploy with empty githubToken used to overwrite a working remote config.php and
# silently kill the contributions heatmap (LOC chart can keep serving from cache).
# If local credentials are missing, reuse whatever is already on the server.
if ([string]::IsNullOrWhiteSpace($githubToken) -or [string]::IsNullOrWhiteSpace($githubOwner)) {
    Write-Host 'Local githubToken/githubOwner missing — checking remote api/config.php...'
    $remoteConfigPath = ($remotePath.TrimEnd('/') + '/api/config.php') -replace "'", "\\'"
    $php = "`$c=@include '$remoteConfigPath'; if(is_array(`$c)){echo (`$c['github_token']??'').chr(10).(`$c['github_owner']??'');}"
    # Remote shells often spam stderr (nvm/node noise); don't let that abort deploy.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $remoteCreds = & ssh @sshArgs $sshTarget "php -r `"$php`"" 2>$null
    $remoteOk = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prevEap
    if ($remoteOk -and $remoteCreds) {
        $lines = @($remoteCreds -split "`n" | ForEach-Object { $_.TrimEnd("`r") })
        if ([string]::IsNullOrWhiteSpace($githubToken) -and $lines.Count -ge 1 -and $lines[0]) {
            $githubToken = $lines[0]
            Write-Host 'Preserved remote github_token'
        }
        if ([string]::IsNullOrWhiteSpace($githubOwner) -and $lines.Count -ge 2 -and $lines[1]) {
            $githubOwner = $lines[1]
            Write-Host "Preserved remote github_owner ($githubOwner)"
        }
    }
    if ([string]::IsNullOrWhiteSpace($githubToken)) {
        Write-Warning 'No GitHub token locally or on the server. Activity charts will have no live data until you set githubToken in deploy.config.json (or GITHUB_TOKEN) and redeploy.'
    }
}

if (-not $SkipBuild) {
    Assert-NodeVersion
    Write-Host 'Installing dependencies...'
    npm ci
    Assert-LastExit 'npm ci'
    Write-Host 'Building production bundle...'
    $env:VITE_ADMIN_PASSWORD = $adminPassword
    npm run build
    Assert-LastExit 'npm run build'
}

$dist = Join-Path $Root 'dist'
if (-not (Test-Path $dist)) {
    throw 'dist/ not found. Run build first.'
}

# Write publish API password config into the build output (not committed).
$apiDir = Join-Path $dist 'api'
if (-not (Test-Path $apiDir)) {
    New-Item -ItemType Directory -Path $apiDir | Out-Null
}
$phpPassword = $adminPassword.Replace('\', '\\').Replace("'", "\'")
$configPhp = @"
<?php
// Generated by deploy.ps1 — do not commit.
return [
    'password' => '$phpPassword',
    'github_token' => '$($githubToken -replace "\\", "\\\\" -replace "'", "\\'")',
    'github_owner' => '$($githubOwner -replace "\\", "\\\\" -replace "'", "\\'")',
];
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $apiDir 'config.php'), $configPhp, $utf8NoBom)

# Keep live data/cards.json if the editor has already published to it.
$remoteCards = & ssh @sshArgs $sshTarget "if [ -f '$remotePath/data/cards.json' ]; then echo exists; fi"
Assert-LastExit 'ssh (checking remote data/cards.json)'
$preserveCards = $remoteCards -match 'exists'

# Upload a tarball and extract it server-side. Windows scp does not expand
# "dist/*" (it treats it as a literal path), so packaging is the reliable path;
# it also carries dotfiles like .htaccess.
$tarArgs = @('-C', $dist)
if ($preserveCards) {
    Write-Host 'Preserving live data/cards.json on server'
    $tarArgs += '--exclude=./data/cards.json'
}
$tarball = Join-Path ([System.IO.Path]::GetTempPath()) "launch-deploy-$([System.Guid]::NewGuid().ToString('N')).tgz"
$tarArgs += @('-czf', $tarball, '.')

if ($DryRun) {
    Write-Host "[dry-run] Would package dist/ and upload to ${sshTarget}:${remotePath}/"
    exit 0
}

Write-Host 'Packaging build output...'
& tar @tarArgs
Assert-LastExit 'tar (packaging dist)'

try {
    Write-Host 'Uploading...'
    & ssh @sshArgs $sshTarget "mkdir -p '$remotePath'"
    Assert-LastExit 'ssh (mkdir remote path)'
    & scp @scpArgs $tarball "${sshTarget}:${remotePath}/_deploy.tgz"
    Assert-LastExit 'scp (upload archive)'
    Write-Host 'Extracting on server...'
    & ssh @sshArgs $sshTarget "cd '$remotePath' && tar -xzf _deploy.tgz && rm -f _deploy.tgz"
    Assert-LastExit 'ssh (extract archive)'
}
finally {
    Remove-Item $tarball -Force -ErrorAction SilentlyContinue
}

# scp creates dirs as 700; Apache needs world-readable assets on shared hosting.
Write-Host 'Fixing permissions...'
& ssh @sshArgs $sshTarget "chmod 755 '$remotePath/assets' '$remotePath/data' '$remotePath/api' 2>/dev/null; find '$remotePath/assets' '$remotePath/data' '$remotePath/api' -type f -exec chmod 644 {} \; 2>/dev/null; chmod 644 '$remotePath/index.html' '$remotePath/.htaccess' '$remotePath/robots.txt' '$remotePath/_headers' 2>/dev/null; chmod 600 '$remotePath/api/config.php' 2>/dev/null"

if ($reloadNginx) {
    Write-Host 'Reloading nginx...'
    & ssh @sshArgs $sshTarget 'sudo nginx -t && sudo systemctl reload nginx'
}

Write-Host 'Deploy complete.'

