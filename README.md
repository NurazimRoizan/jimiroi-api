# 🧠 jimiroi-api

The central nervous system for Nurazim's digital presence. Built with [Hono](https://hono.dev/), running on the Vercel Edge Network, and backed by Upstash Redis.

This API acts as a universal webhook router and background worker, seamlessly connecting the Next.js portfolio, independent PWAs like PiYak, and a centralized Discord command center.

## 🚀 Features

- **👀 Geo-Stalker (Portfolio Analytics):** Automatically parses Vercel IP headers (`x-vercel-ip-country`, `x-vercel-ip-city`) to track where visitors are viewing the portfolio from in real-time, pinging a Discord webhook instantly.
- **🤖 AI Wiretap:** Silently intercepts user queries made to the Portfolio's AI Chatbot and logs the questions to Discord so the creator knows exactly what recruiters are asking the AI.
- **🔗 Cross-Project Sync (PiYak):** Acts as a webhook receiver for external side-projects (e.g., PiYak). It listens for Clerk user registrations and internal database triggers to log cross-project milestones in a central Discord channel.
- **💀 The Mortality Report (Daily Cron):** A brutalist, daily accountability script powered by Vercel Cron Jobs. Every morning at 8:00 AM MYT, it pings a dedicated Discord webhook with a countdown of days lived vs. days remaining (assuming a 60-year lifespan), countdowns to personal milestones, the next local public holiday, and a randomized brutal quote of the day fetched via API-Ninjas.

## 🛠️ Tech Stack

- **Framework:** Hono (TypeScript)
- **Deployment:** Vercel (Serverless Edge Functions + Cron Jobs)
- **Database:** Upstash Redis
- **Integrations:** Discord Webhooks, API-Ninjas, Clerk Webhooks

## 💻 Development Setup

### Prerequisites
- [Vercel CLI](https://vercel.com/docs/cli) installed globally

### Local Development
```bash
npm install
vc dev
# Runs on http://localhost:3000
```

### Environment Variables Required
- `DISCORD_WEBHOOK_URL` (For general project logging)
- `DISCORD_HONEST_CLOCK_WEBHOOK_URL` (For the Mortality Report routing)
- `API_NINJAS_KEY` (For facts, history, and quotes)
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (For portfolio view counters)

## 🚢 Deployment

To build and deploy manually:
```bash
npm run build
vc deploy --prod
```
