<div align="center">

# ScrollHub

### A fast, all-in-one unblocked games platform with live chat, a built-in economy, and real-time multiplayer.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](#copyright)
[![Status](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)](#)

*1,000+ games. One server. Zero setup for players.*

</div>

---

## Overview

ScrollHub is a single Node.js service that bundles everything into one deploy: a static frontend, a game catalog that stays in sync with upstream packs, an integrated web proxy, and a live backend powering chat, an in-site economy, and real-time multiplayer. Point it at a host, add a couple of environment variables, and it runs.

Because the frontend and backend ship together on the same origin, the proxy and all real-time features work out of the box with no cross-domain wiring.

---

## Features

**Games**
- 1,000+ titles, auto-synced from upstream packs and deduplicated
- Dedicated "New Games" page with instant search
- External titles loaded cross-origin for zero proxy overhead
- Built-in web proxy for titles that need it

**Social**
- Live chat with @mentions and ping autocomplete
- Image and GIF sharing
- Send-to-everyone broadcasts
- Unique nicknames, one per account, shown in place of guest names
- Online presence and an achievements system

**Economy — Scrolls Casino**
- Daily Scrolls payouts
- Blackjack, slots, coinflip, and case openings
- Case battles, head-to-head
- A store for chat tags and profile customization

**Admin**
- Grant Scrolls to any player
- Site-wide takeover modes
- Broadcast messages to all users
- One-click nickname reset

**Live events**
- Skribbl-style draw-and-guess, powered by WebSockets

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (native HTTP server, no framework) |
| Static serving | [sirv](https://github.com/lukeed/sirv) with immutable asset caching |
| Proxy | [wisp-js](https://github.com/MercuryWorkshop/wisp-js) WebSocket transport |
| Real-time | `ws` WebSocket servers (chat, Skribbl, case battles) |
| Persistence | [Upstash Redis](https://upstash.com) (REST, serverless) |
| Frontend | Vite + React, served from the same origin |

---

## Deploy to Render

The whole platform deploys as a single **Web Service**. A static site will not work — the backend must run.

**1. Push to GitHub**

Make sure this repo (`server.js`, `casino.js`, `skribbl.js`, `dist/`, `package.json`) is pushed to a GitHub repository.

**2. Create the service**

Go to [render.com](https://render.com) and create a **New Web Service**, then connect your repo.

| Setting | Value |
|---------|-------|
| Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

**3. Add environment variables**

See the table below. At minimum, set `ADMIN_PASSWORD`. Add the Upstash variables to make data survive restarts.

**4. Deploy**

Click **Create Web Service** and wait about two minutes. Your site goes live at:

```
https://<your-service-name>.onrender.com
```

That URL is the complete site — frontend, backend, games, and all.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ADMIN_PASSWORD` | Recommended | Unlocks the admin panel. Set your own; never commit it. |
| `UPSTASH_REDIS_REST_URL` | Recommended | Durable storage so chat, Scrolls, and profiles survive restarts. |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Auth token that pairs with the URL above. |
| `TMDB_API_KEY` | Optional | Enables the movies section. |
| `GROQ_API_KEY` | Optional | Enables AI features. |
| `UPSTREAM_ORIGIN` | Optional | Overrides the default upstream game source. |
| `PORT` | Auto | Set by the host. Defaults to `8080` locally. |

> Without the Upstash variables the site still runs, but player data lives in temporary storage and resets whenever the host restarts or sleeps.

---

## Local Development

```bash
# Install dependencies
npm install

# Set your admin password for this session
export ADMIN_PASSWORD="choose-your-own"

# Start the server
npm start
```

Then open `http://localhost:8080`.

---

## Project Structure

```
scroll-backend/
├── server.js        Main server: routing, proxy, chat, admin, catalog
├── casino.js        Scrolls economy: games, store, cases, battles
├── skribbl.js       Real-time draw-and-guess WebSocket game
├── dist/            Built frontend and static pages
│   ├── extframe.html    Cross-origin game loader
│   ├── newgames/        New Games browser
│   ├── casino/          Casino UI
│   └── admin/           Admin panel
└── package.json
```

---

## Performance and Scaling

ScrollHub is tuned to run comfortably on free hosting:

- **Immutable caching** on hashed assets so browsers and CDNs cache aggressively
- **Bundle offload** to a public CDN, keeping heavy static files off the origin
- **Outbound concurrency limits** and a bounded in-memory asset cache to stay within modest memory budgets
- **Crash guards** on unhandled rejections and exceptions so a single bad request never takes the server down
- **Cross-origin game loading** so most game traffic never touches your bandwidth

For higher traffic, place a free CDN such as Cloudflare in front of the origin to cache static responses and absorb load.

---

## Copyright

Copyright &copy; 2026 ScrollHub. All rights reserved.

This software and its source code are proprietary. No part of this project may be copied, redistributed, resold, or used to create derivative works without the express written permission of the copyright holder. Third-party components retain their respective licenses.

