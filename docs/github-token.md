# GitHub Token Management

The activity chart and contributions heatmap on gennetten.org fetch live data from the GitHub API. This requires a personal access token with appropriate permissions.

## Creating a GitHub Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Choose one of these token types:

### Classic Token (Recommended)
- Click **Generate new token (classic)**
- Grant these scopes:
  - `repo` (Full control of private repositories)
  - `read:user` (Read user profile data)
- Set an expiration (or "No expiration" if you prefer)
- Copy the token (starts with `ghp_...`)

### Fine-Grained Token
- Click **Generate new token**
- Under **Repository access**, select the repos you want to track
- Grant these **repository permissions**:
  - **Contents**: Read-only
  - **Metadata**: Read-only (auto-selected)
- Set an expiration
- Copy the token (starts with `github_pat_...`)

## Local Configuration

Add the token to `deploy.config.json`:

```json
{
  "host": "your-server.com",
  "user": "your-user",
  "path": "/path/to/site",
  "port": 22,
  "githubToken": "ghp_YourTokenHere",
  "githubOwner": "your-github-username"
}
```

**Note**: `deploy.config.json` is git-ignored and never committed.

## Server Configuration (Token Persistence)

The deploy scripts generate `api/config.php` with the token on every deploy. To prevent a token from being wiped if you lose your local `deploy.config.json`, create a server-only config file:

1. SSH to your server
2. Navigate to the site's `api/` directory
3. Create `config.local.php`:

```php
<?php
return [
    'github_token' => 'ghp_YourTokenHere',
    'github_owner' => 'your-github-username',
];
```

4. Set restrictive permissions:

```bash
chmod 600 api/config.local.php
```

The PHP endpoints check `config.local.php` first, then fall back to the generated `config.php`. This file is **never** deployed or overwritten, so your token persists even if a deploy has missing credentials.

## Token Rotation

When rotating a token:

1. Create a new token on GitHub (see above)
2. Update `deploy.config.json` locally **and/or** `api/config.local.php` on the server
3. Redeploy (if updating locally) or restart the site (if updating server-only)

The old token can be revoked immediately after the new one is live.

## Staleness Detection & Cache Behavior

The endpoints now include intelligent cache preservation to prevent data loss:

### Activity Chart (`/api/github-stats.php`)

- **Success Rate Tracking**: Only HTTP 200 with non-empty arrays count as successful repo fetches
- **202 Handling**: GitHub sometimes returns 202 "stats not computed yet" — the script retries with backoff
- **Cache Preservation Rules**:
  - If **fewer than 80% of repos succeed**, the old cache is served instead
  - If **authentication fails** (401/403), the old cache is served with `source: 'error'`
  - If a deploy **loses the token**, the script won't overwrite a `private` cache with `public` data
- **Metadata**: The response includes `fetched_at`, `stale`, `stale_reason`, `success_count`, and `total_repos`

### Contributions Heatmap (`/api/github-contributions.php`)

- **Staleness Markers**: If the GraphQL request fails, the old cache is served with `stale: true` and `cache_age_seconds`
- **Authentication Errors**: Detected via GraphQL error types and triggers fallback to cached data
- **Source Label Fix**: Corrected the misleading source label (`private` when using a token, `public` for username-only, `none` for neither)

### UI Indicators

Both widgets now show subtle warnings when data is stale:

- **Activity Chart**: Status text changes to amber and adds a ⚠️ icon when serving cached or partial data
- **Contributions Heatmap**: Shows cache age and reason in small amber text below the total

## Troubleshooting

### "GitHub authentication failed — showing cached data"
- Your token expired or was revoked
- Create a new token and update `deploy.config.json` or `config.local.php`

### "Partial GitHub data available — showing cached data"
- GitHub returned 202 or empty arrays for many repos
- Usually transient — wait a few hours and the cache will refresh

### "Token missing — showing cached private data"
- A deploy happened without a token in `deploy.config.json`
- Old private data is preserved; add the token and redeploy to resume updates

### Chart shows zeros or sample data
- No token configured at all, or the cache was deleted
- Add a token and wait for the cache TTL (6 hours) to expire, or manually delete the cache files on the server:
  ```bash
  rm data/github-stats-cache.json data/github-contributions-cache.json
  ```

## Cache Files

Two cache files live on the server:

- `data/github-stats-cache.json` — Activity chart data (TTL: 6 hours)
- `data/github-contributions-cache.json` — Contributions heatmap (TTL: 6 hours)

These are **preserved across deploys** and only updated when new data is successfully fetched. Deploying does not reset the cache.
