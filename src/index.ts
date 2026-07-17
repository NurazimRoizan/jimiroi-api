import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

import { Redis } from '@upstash/redis'

// Enable CORS so the Next.js portfolio can fetch this API
app.use('/*', cors({
  origin: (origin) => origin,
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

const sendDiscordNotification = async (message: string, customWebhookUrl?: string) => {
  const webhookUrl = customWebhookUrl || process.env.DISCORD_WEBHOOK_URL
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
    const lifespanDays = 60 * 365.25;
    const daysLived = Math.floor((today.getTime() - myBirthday.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.floor(lifespanDays - daysLived);
    
    let lifeExpectancyText = `You have exactly **${daysLeft.toLocaleString()}** days left until you hit 60.`;
    if (daysLeft <= 0) {
        lifeExpectancyText = `You are statistically expired. You are past 60. Stop counting days, your body is already falling apart. Just try to survive.`;
    }

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

    const milestones = [
        { name: "GF's Birthday", days: getDaysUntil(5, 21), icon: "🎂" },
        { name: "Your Birthday", days: getDaysUntil(7, 31), icon: "🎉" },
        { name: "Anniversary", days: getDaysUntil(6, 15), icon: "💞" },
        { name: "Wedding Day", days: getDaysUntilSpecific('2027-03-27'), icon: "💍" }
    ];
    milestones.sort((a, b) => a.days - b.days);
    const nextMilestone = milestones[0];

    let easterEgg = "";
    if (nextMilestone.days === 0) {
        easterEgg = `\n🚨 **WAKE UP! IT IS TODAY!** 🚨\nDrop everything. It is ${nextMilestone.name}. Do not mess this up.\n`;
    }

    // Fetch Malaysia Holidays (Melaka & Putrajaya)
    let nextHolidayStr = "Data unavailable";
    try {
        const states = ['MLK', 'PJY'];
        const allHolidays = new Map();

        for (const state of states) {
            const res = await fetch(`https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=${currentYear}&state=${state}`);
            if (res.ok) {
                const json = await res.json();
                const holidays = json.data || [];
                holidays.forEach((h: any) => {
                    const key = `${h.date}-${h.name}`;
                    if (!allHolidays.has(key)) {
                        allHolidays.set(key, { ...h, states: [state] });
                    } else {
                        allHolidays.get(key).states.push(state);
                    }
                });
            }
        }

        const mergedHolidays = Array.from(allHolidays.values());
        mergedHolidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const futureHolidays = mergedHolidays.filter((h: any) => new Date(h.date).getTime() >= today.getTime());

        if (futureHolidays.length > 0) {
            const nextHol = futureHolidays[0];
            const daysToHol = Math.ceil((new Date(nextHol.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const stateLabels = nextHol.states.length === 2 ? "MLK & PJY" : nextHol.states[0];
            nextHolidayStr = `**${nextHol.name}** (${stateLabels}) is in \`${daysToHol}\` days (${nextHol.date})`;
        } else {
            nextHolidayStr = "No more holidays this year!";
        }
    } catch (e) {
        console.error("Holiday API failed", e);
    }

    // API-Ninjas Integration
    const fetchNinja = async (endpoint: string) => {
        if (!process.env.API_NINJAS_KEY) return null;
        try {
            const res = await fetch(`https://api.api-ninjas.com/v1/${endpoint}`, {
                headers: { 'X-Api-Key': process.env.API_NINJAS_KEY }
            });
            if (res.ok) return await res.json();
        } catch (e) {
            console.error(`Ninja API error for ${endpoint}`, e);
        }
        return null;
    };

    const currentMonth = mytTime.getMonth() + 1;
    const currentDay = mytTime.getDate();

    const [historyRes, factRes, jokeRes, quoteRes] = await Promise.all([
        fetchNinja('dayinhistory'),
        fetchNinja('factoftheday'),
        fetchNinja('jokeoftheday'),
        fetchNinja('quotes?category=humor&limit=1')
    ]);

    // Fallback brutal quote if API key is missing or request fails
    let quoteStr = `> *"Another day closer to the void. Make it count."*`;
    if (quoteRes && quoteRes.length > 0) {
        quoteStr = `> *"${quoteRes[0].quote}"* \n> — **${quoteRes[0].author}**`;
    }

    let extraStr = "";
    if (factRes) {
        const f = Array.isArray(factRes) ? factRes[0] : factRes;
        if (f && f.fact) extraStr += `\n**🧠 Useless Fact Nobody Asked For:**\n${f.fact}\n`;
    }
    if (jokeRes) {
        const j = Array.isArray(jokeRes) ? jokeRes[0] : jokeRes;
        const jokeText = j?.joke || j?.text;
        if (jokeText) extraStr += `\n**🤡 Mandatory Coping Mechanism:**\n${jokeText}\n`;
    }
    if (historyRes) {
        const h = Array.isArray(historyRes) ? historyRes[0] : historyRes;
        const eventText = h?.event || h?.text;
        const yearStr = h?.year || '';
        if (eventText) extraStr += `\n**📜 On this day in history${yearStr ? ` (${yearStr})` : ''}:**\n${eventText}\n`;
    }

    const message = `
# ⬛ THE MORTALITY REPORT ⬛

${quoteStr}

**STATUS:** ${lifeExpectancyText}
**LOG:** You have survived **${daysLived.toLocaleString()}** days. What are you doing with today?
${easterEgg}
---
### 🎯 NEXT INEVITABLE MILESTONE
${nextMilestone.icon} **${nextMilestone.name}**
⏳ \`${nextMilestone.days}\` days remaining.

### 🌴 NEXT STATE ESCAPE (MLK & PJY)
${nextHolidayStr}
---
### 🎲 DISTRACTIONS FROM THE VOID
${extraStr || "*(API-Ninjas key not configured)*"}
---
*End of report.*
`;

    await sendDiscordNotification(message, process.env.DISCORD_HONEST_CLOCK_WEBHOOK_URL);

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

// --- AJEM & NUUL RSVP / GUESTBOOK ENDPOINTS ---

app.post('/rsvp', async (c) => {
  try {
    const body = await c.req.json()
    const { name, attendance, message } = body
    if (!name || !attendance) {
      return c.json({ error: 'Name and attendance are required' }, 400)
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    
    if (!redisUrl || !redisToken) {
       return c.json({ error: 'Redis is not configured' }, 500)
    }

    const redis = new Redis({ url: redisUrl, token: redisToken })
    
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const createdAt = new Date().toISOString()
    
    const entry = {
      id,
      name,
      attendance,
      message: message || '',
      createdAt
    }

    // Save to Redis Hash (Hash name: ajemnuul:rsvps)
    // Reverting to the 2-argument signature for TypeScript compatibility
    await redis.hset('ajemnuul:rsvps', { [id]: JSON.stringify(entry) })
    
    // Discord Notification
    const origin = new URL(c.req.url).origin
    const adminSecret = process.env.ADMIN_SECRET || 'NOT_SET'
    const actualDeleteLink = `${origin}/rsvp/delete/${id}?secret=${adminSecret}`

    const discordMsg = `🎉 **New RSVP Received!** 🎉\n**Name:** ${name}\n**Attendance:** ${attendance}\n**Wish:** ${message || '*No message*'}\n\n[🗑️ Click here to Delete this message](${actualDeleteLink})`
    
    await sendDiscordNotification(discordMsg)

    return c.json({ success: true, entry })
  } catch (error: any) {
    console.error('RSVP error:', error)
    return c.json({ error: 'Failed to submit RSVP' }, 500)
  }
})

app.get('/rsvp', async (c) => {
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!redisUrl || !redisToken) {
       return c.json({ error: 'Redis is not configured' }, 500)
    }
    const redis = new Redis({ url: redisUrl, token: redisToken })
    
    const rsvpsHash = await redis.hgetall('ajemnuul:rsvps')
    
    let rsvps: any[] = []
    if (rsvpsHash) {
       rsvps = Object.values(rsvpsHash).map((val: any) => typeof val === 'string' ? JSON.parse(val) : val)
       // Sort by date descending
       rsvps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    
    return c.json({ success: true, rsvps, rawHash: rsvpsHash })
  } catch (error: any) {
    console.error('Fetch RSVP error:', error)
    return c.json({ error: 'Failed to fetch RSVPs' }, 500)
  }
})

app.get('/rsvp/delete/:id', async (c) => {
  const id = c.req.param('id')
  const secret = c.req.query('secret')
  
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || secret !== adminSecret) {
    return c.json({ error: 'Unauthorized. Invalid secret.' }, 401)
  }

  // Return a confirmation page to prevent Discord link preview crawlers from auto-deleting!
  return c.html(`
    <div style="font-family: sans-serif; padding: 2rem; text-align: center; max-width: 500px; margin: 0 auto;">
      <h1 style="color: #d4af37;">Confirm Deletion 🗑️</h1>
      <p>Are you sure you want to permanently delete this message from the guestbook?</p>
      <form method="POST" action="/rsvp/delete/${id}?secret=${secret}">
        <button type="submit" style="background-color: #ff4757; color: white; border: none; padding: 1rem 2rem; font-size: 1.1rem; border-radius: 8px; cursor: pointer; margin-top: 1rem; font-weight: bold;">
          Yes, Delete Message
        </button>
      </form>
    </div>
  `)
})

app.post('/rsvp/delete/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const secret = c.req.query('secret')
    
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret || secret !== adminSecret) {
      return c.json({ error: 'Unauthorized. Invalid secret.' }, 401)
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    const redis = new Redis({ url: redisUrl, token: redisToken })
    
    await redis.hdel('ajemnuul:rsvps', id)
    
    return c.html(`
      <div style="font-family: sans-serif; padding: 2rem; text-align: center; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #2ed573;">Success! 🗑️</h1>
        <p>The message has been permanently deleted from the guestbook.</p>
        <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 2rem;">You can safely close this tab now.</p>
      </div>
    `)
  } catch (error: any) {
    console.error('Delete RSVP error:', error)
    return c.json({ error: 'Failed to delete RSVP' }, 500)
  }
})

app.get('/test-redis', async (c) => {
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    const redis = new Redis({ url: redisUrl, token: redisToken })
    
    await redis.hset('test:key', { f1: 'v1' })
    const res = await redis.hgetall('test:key')
    
    return c.json({ success: true, res })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

import { verifyKey } from 'discord-interactions'

app.post('/discord/interactions', async (c) => {
  const signature = c.req.header('x-signature-ed25519')
  const timestamp = c.req.header('x-signature-timestamp')
  const rawBody = await c.req.text()
  
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey || !signature || !timestamp) {
    return c.json({ error: 'Missing headers or public key' }, 401)
  }

  let isValidRequest = false
  try {
    isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey)
  } catch (e) {
    return c.json({ error: 'Signature verification crashed. Check Public Key format.' }, 401)
  }

  if (!isValidRequest) {
    return c.json({ error: 'Bad request signature' }, 401)
  }

  const body = JSON.parse(rawBody)

  // 1. Handle PING from Discord
  if (body.type === 1) {
    return c.json({ type: 1 }) // PONG
  }

  // 2. Handle /rsvps Slash Command
  if (body.type === 2 && body.data.name === 'rsvps') {
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
      const redis = new Redis({ url: redisUrl as string, token: redisToken as string })
      
      const rsvpsHash = await redis.hgetall('ajemnuul:rsvps')
      let rsvps: any[] = []
      if (rsvpsHash) {
         rsvps = Object.values(rsvpsHash).map((val: any) => typeof val === 'string' ? JSON.parse(val) : val)
         // Sort oldest first for a clean list
         rsvps.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }

      const coming = rsvps.filter(r => r.attendance === 'yes')
      const decline = rsvps.filter(r => r.attendance === 'no')

      let text = `📜 **AJEM & NUUL GUEST LIST** 📜\n\n`
      text += `✅ **Coming (${coming.length}):**\n` + (coming.length > 0 ? coming.map(c => `- ${c.name}`).join('\n') : '*None yet*') + `\n\n`
      if (decline.length > 0) {
        text += `❌ **Not Coming (${decline.length}):**\n` + decline.map(c => `- ${c.name}`).join('\n')
      }

      // Discord message limit is 2000 chars
      if (text.length > 1950) {
        text = text.substring(0, 1900) + '\n... *(List truncated due to Discord length limits)*'
      }

      return c.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: text,
          flags: 64 // EPHEMERAL (Only you can see this message)
        }
      })
    } catch (err) {
      console.error(err)
      return c.json({
        type: 4,
        data: {
          content: '❌ Failed to fetch RSVPs from the database.',
          flags: 64
        }
      })
    }
  }

  return c.json({ error: 'Unknown command' }, 400)
})

export default app
