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

## 🧠 Philosophy

Most developers build APIs for other people. This API is built entirely for *me*. It is a selfish, highly opinionated, brutally honest system designed to keep me accountable, track my digital footprint across the web, and aggregate the noise of multiple side projects into a single, cohesive Discord dashboard.

Stop building SaaS for free users who complain. Build a nervous system for yourself.
