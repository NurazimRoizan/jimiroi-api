import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

import { Redis } from '@upstash/redis'

// Enable CORS so the Next.js portfolio can fetch this API
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://jimiroi.com', 'https://portfolio.jimiroi.com'],
  allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

app.get('/', (c) => {
  return c.json({ message: 'jimiroi-api is online.', version: '1.0.0' })
})

import { env } from 'hono/adapter'

app.post('/track', async (c) => {
  try {
    const body = await c.req.json()
    const { event, path, project = 'portfolio' } = body

    if (!event) {
      return c.json({ error: 'Event name is required' }, 400)
    }

    // Safely get environment variables across all Vercel runtimes (Edge or Node)
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = env<{ UPSTASH_REDIS_REST_URL?: string, UPSTASH_REDIS_REST_TOKEN?: string }>(c)

    // If we don't have Redis configured (e.g., running locally), just mock it
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
      console.log(`[Local Analytics Mock] Project: ${project} | Event: ${event} | Path: ${path || 'N/A'}`)
      return c.json({ success: true, mock: true })
    }

    // Connect to Upstash Redis explicitly
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
    
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const dailyKey = `analytics:${project}:${event}:${date}`
    const totalKey = `analytics:${project}:${event}:total`

    // Increment both the daily counter and the all-time total counter
    await Promise.all([
      redis.incr(dailyKey),
      redis.incr(totalKey)
    ])

    return c.json({ success: true })
  } catch (error: any) {
    console.error('Tracking error:', error)
    return c.json({ error: 'Failed to track event' }, 500)
  }
})

app.get('/stats/github', async (c) => {
  // We use standard fetch to hit GitHub's REST API. 
  // Note: Unauthenticated requests are limited to 60 per hour.
  // In production, you should pass a GitHub PAT in process.env.GITHUB_TOKEN
  const username = 'NurazimRoizan'
  const headers: Record<string, string> = {
    'User-Agent': 'jimiroi-api',
  }
  
  // Vercel serverless environment variables
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
  }

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers })
    ])

    if (!userRes.ok || !reposRes.ok) {
      throw new Error('Failed to fetch from GitHub')
    }

    const userData = await userRes.json()
    const reposData: any[] = await reposRes.json()

    // Aggregate stats
    let totalStars = 0
    const languageCounts: Record<string, number> = {}

    reposData.forEach((repo) => {
      totalStars += repo.stargazers_count
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1
      }
    })

    // Sort top 3 languages
    const topLanguages = Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang]) => lang)

    return c.json({
      followers: userData.followers,
      publicRepos: userData.public_repos,
      totalStars,
      topLanguages,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
