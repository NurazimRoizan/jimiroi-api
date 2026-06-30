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

const sendDiscordNotification = async (message: string) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    })
  } catch (e) {
    console.error('Failed to send discord notification:', e)
  }
}

app.get('/cron/honest-clock', async (c) => {
  try {
    // Vercel Cron adds a Bearer token matching CRON_SECRET, but we'll accept requests to this endpoint for testing
    // To strictly lock it down, uncomment:
    // const authHeader = c.req.header('Authorization');
    // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) return c.json({ error: 'Unauthorized' }, 401);

    const today = new Date();
    // Force MYT timezone (UTC+8) for local date calculation
    const mytTime = new Date(today.getTime() + (8 * 60 * 60 * 1000));
    const currentYear = mytTime.getUTCFullYear();
    
    // Dates
    const myBirthday = new Date('2002-07-31');
    const lifespanDays = 80 * 365.25;
    const daysLived = Math.floor((today.getTime() - myBirthday.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.floor(lifespanDays - daysLived);

    // Calculate days until next occurrence of an annual event
    const getDaysUntil = (month: number, day: number) => {
        let nextDate = new Date(Date.UTC(currentYear, month - 1, day));
        if (nextDate.getTime() < today.getTime()) {
            nextDate = new Date(Date.UTC(currentYear + 1, month - 1, day));
        }
        return Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Calculate days until a specific future date (e.g., Wedding)
    const getDaysUntilSpecific = (targetDateString: string) => {
        const nextDate = new Date(targetDateString);
        return Math.max(0, Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const daysToGfBday = getDaysUntil(5, 21);
    const daysToMyBday = getDaysUntil(7, 31);
    const daysToAnniversary = getDaysUntil(6, 15);
    const daysToWedding = getDaysUntilSpecific('2027-03-27');

    // Fetch Malaysia Holidays (Melaka)
    let nextHolidayStr = "Data unavailable";
    try {
        const res = await fetch(`https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=${currentYear}&state=MLK`);
        if (res.ok) {
            const json = await res.json();
            const holidays = json.data || [];
            // Find the closest future holiday
            const futureHolidays = holidays.filter((h: any) => new Date(h.date).getTime() >= today.getTime());
            if (futureHolidays.length > 0) {
                const nextHol = futureHolidays[0];
                const daysToHol = Math.ceil((new Date(nextHol.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                nextHolidayStr = `**${nextHol.name}**\n${daysToHol} days away (${nextHol.date})`;
            } else {
                nextHolidayStr = "No more holidays this year!";
            }
        }
    } catch (e) {
        console.error("Holiday API failed", e);
    }

    const message = `
💀 **THE HONEST CLOCK** 💀
Wake up. You have exactly **${daysLeft.toLocaleString()}** days left to live (assuming 80 years).
You have lived **${daysLived.toLocaleString()}** days so far. What are you doing with today?

📅 **MILESTONES AHEAD:**
- 🎂 GF's Birthday: \`${daysToGfBday}\` days
- 🎉 Your Birthday: \`${daysToMyBday}\` days
- 💞 Anniversary: \`${daysToAnniversary}\` days
- 💍 Wedding Day: \`${daysToWedding}\` days

🌴 **NEXT PUBLIC HOLIDAY (Melaka):**
${nextHolidayStr}
`;

    await sendDiscordNotification(message);

    return c.json({ success: true, message: "Honest Clock triggered" });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/track', async (c) => {
  try {
    const body = await c.req.json()
    const { event, path, project = 'portfolio', message } = body

    // Geo-Stalker headers provided natively by Vercel
    const country = c.req.header('x-vercel-ip-country') || 'Unknown Country'
    const city = c.req.header('x-vercel-ip-city') || 'Unknown City'
    const userAgent = c.req.header('user-agent') || 'Unknown Device'

    if (!event) {
      return c.json({ error: 'Event name is required' }, 400)
    }

    // Since this runs on Vercel Node Serverless, we use process.env directly
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

    // If we don't have Redis configured (e.g., running locally), just mock it
    if (!redisUrl || !redisToken) {
      console.log(`[Local Analytics Mock] Project: ${project} | Event: ${event} | Path: ${path || 'N/A'}`)
      
      // Still test discord locally if configured
      if (event === 'resume_download') {
        await sendDiscordNotification(`[LOCAL] 🚨 **NEW RESUME DOWNLOAD** 🚨\nSomeone downloaded your CV from ${project}!`)
      } else if (event === 'page_view') {
        await sendDiscordNotification(`[LOCAL] 👀 **VIBE CHECK** 👀\nSomeone from ${city}, ${country} is viewing your portfolio!\nDevice: \`${userAgent}\``)
      } else if (event === 'ai_chat') {
        await sendDiscordNotification(`[LOCAL] 🤖 **AI WIRETAP** 🤖\nA user just asked your AI:\n> "${message || 'Unknown question'}"`)
      } else if (event === 'partner_linked') {
        await sendDiscordNotification(`[LOCAL] 💞 **NEW PARTNER LINKED** 💞\nSomeone from ${city}, ${country} just linked up in PiYak!`)
      } else if (event === 'user_registered') {
        await sendDiscordNotification(`[LOCAL] 🥳 **NEW PiYak USER** 🥳\nA brand new user just registered in PiYak!`)
      }
      return c.json({ success: true, mock: true })
    }

    // Connect to Upstash Redis explicitly
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    })
    
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const dailyKey = `analytics:${project}:${event}:${date}`
    const totalKey = `analytics:${project}:${event}:total`

    // Increment both the daily counter and the all-time total counter
    await Promise.all([
      redis.incr(dailyKey),
      redis.incr(totalKey)
    ])

    // Feature #5, #6, #2: Chaotic Discord Notifications
    if (event === 'resume_download') {
      await sendDiscordNotification(`🚨 **NEW RESUME DOWNLOAD** 🚨\nSomeone from ${city}, ${country} just downloaded your CV from ${project}!`)
    } else if (event === 'page_view') {
      await sendDiscordNotification(`👀 **VIBE CHECK** 👀\nSomeone from ${city}, ${country} is viewing your portfolio!\nDevice: \`${userAgent}\``)
    } else if (event === 'ai_chat') {
      await sendDiscordNotification(`🤖 **AI WIRETAP** 🤖\nA user from ${city}, ${country} just asked your AI:\n> "${message || 'Unknown question'}"`)
    } else if (event === 'partner_linked') {
      await sendDiscordNotification(`💞 **NEW PARTNER LINKED** 💞\nSomeone from ${city}, ${country} just linked up in PiYak!`)
    } else if (event === 'user_registered') {
      await sendDiscordNotification(`🥳 **NEW PiYak USER** 🥳\nA brand new user just registered in PiYak!`)
    }

    return c.json({ success: true })
  } catch (error: any) {
    console.error('Tracking error:', error)
    
    // Feature #5: System error monitoring
    await sendDiscordNotification(`⚠️ **jimiroi-api ERROR** ⚠️\nTracking endpoint failed: \`${error.message}\``)
    
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
