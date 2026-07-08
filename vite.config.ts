import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only implementation of /api/github-stats.php.
 *
 * Vite serves public/api/*.php as static files (the raw source), so in dev the
 * chart's fetch parses "<?php ..." as JSON and fails, falling back to sample
 * data. This middleware runs the same logic the PHP does — in Node — so dev
 * matches production. Token/owner come from GITHUB_TOKEN / GITHUB_OWNER env, or
 * deploy.config.json, mirroring the deploy scripts' precedence.
 */
function githubStatsDevPlugin(): Plugin {
  return {
    name: 'dev-github-stats',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0].endsWith('/api/github-stats.php')) {
          return next()
        }
        void handleGithubStats()
          .then((body) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(body))
          })
          .catch(() => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = 200
            res.end(JSON.stringify({ values: [], repositories: 0, source: 'none' }))
          })
      })
    },
  }
}

type DeployConfig = { githubToken?: string; githubOwner?: string }

function readDeployConfig(): DeployConfig {
  try {
    const path = fileURLToPath(new URL('./deploy.config.json', import.meta.url))
    return JSON.parse(readFileSync(path, 'utf8')) as DeployConfig
  } catch {
    return {}
  }
}

type GithubResponse = { ok: boolean; status: number; body: string }

async function githubRequest(url: string, token: string): Promise<GithubResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'launch-page-editor',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(url, { headers })
    const body = await response.text()
    return { ok: response.ok, status: response.status, body }
  } catch {
    return { ok: false, status: 0, body: '' }
  }
}

async function githubStatsWithRetry(url: string, token: string): Promise<GithubResponse> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await githubRequest(url, token)
    // 202 = GitHub is still computing the stats; wait and retry.
    if (response.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    return response
  }
  return githubRequest(url, token)
}

function aggregateWeeklyAdditions(responses: GithubResponse[]): { values: number[]; repositories: number } {
  const weekly = new Array<number>(52).fill(0)
  let repositories = 0

  for (const response of responses) {
    if (!response.ok) continue
    let data: unknown
    try {
      data = JSON.parse(response.body)
    } catch {
      continue
    }
    if (!Array.isArray(data)) continue

    repositories++
    const slice = data.slice(-52)
    slice.forEach((entry, index) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        weekly[index] += Number(entry[1]) || 0
      }
    })
  }

  return { values: weekly, repositories }
}

async function handleGithubStats() {
  const config = readDeployConfig()
  const token = process.env.GITHUB_TOKEN || config.githubToken || ''
  const owner = process.env.GITHUB_OWNER || config.githubOwner || ''

  let repos: unknown = []
  if (token) {
    const reposResponse = await githubRequest(
      'https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc',
      token,
    )
    if (reposResponse.ok) repos = JSON.parse(reposResponse.body)
  } else if (owner) {
    const reposResponse = await githubRequest(
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&direction=desc`,
      token,
    )
    if (reposResponse.ok) repos = JSON.parse(reposResponse.body)
  }

  const statsResponses: GithubResponse[] = []
  if (Array.isArray(repos)) {
    for (const repo of repos) {
      const fullName = (repo as { full_name?: string })?.full_name
      if (!fullName) continue
      statsResponses.push(
        await githubStatsWithRetry(
          `https://api.github.com/repos/${encodeURIComponent(fullName).replace(/%2F/g, '/')}/stats/code_frequency`,
          token,
        ),
      )
    }
  }

  const { values, repositories } = aggregateWeeklyAdditions(statsResponses)
  return {
    values,
    repositories,
    source: token ? 'private' : owner ? 'public' : 'none',
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), githubStatsDevPlugin()],
})
