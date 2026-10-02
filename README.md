<div align="center">

# Saturn

### A real-time messaging platform — DMs, group chats, Discord-style communities & voice/video calls.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**[Live demo](#)** <!-- TODO: lien de la démo en ligne --> · **[Screenshots](#screenshots)** · **[Source](https://github.com/Franckprivat/Saturn)**

</div>

---

## Overview

**Saturn** is a full-stack real-time chat application I built to explore production-grade architecture: WebSocket messaging, peer-to-peer WebRTC calls, authentication, file storage and a themeable design system — all wired together and shipped with Docker and CI.

It combines the **1-to-1 / group messaging** of WhatsApp with the **server / channel** model of Discord, including voice and video calls.

> Built as a portfolio project to demonstrate full-stack ownership: from database modelling to real-time infrastructure, security and DX.

---

## Screenshots

<!-- TODO: ajouter les captures dans docs/ (chat.png, communities.png, call.png, profile.png). -->

| Real-time chat | Communities |
|:---:|:---:|
| ![Chat](docs/chat.png) | ![Communities](docs/communities.png) |
| **Video call** | **Profile & themes** |
| ![Call](docs/call.png) | ![Profile](docs/profile.png) |

---

## Features

### Messaging
- **Real-time** 1-to-1 and group conversations over WebSockets (Socket.IO)
- **Typing indicators**, message **reactions**, and WhatsApp-style **read receipts** (sent / delivered / read)
- **Pinned messages**, replies and **file / image attachments**
- Persistent history backed by PostgreSQL

### Social
- Friend system (requests, accept / decline)
- Group conversations with custom names
- Public **profiles** with bio, social links and a shareable **QR code**

### Communities (Discord-style)
- Create communities with **categories & channels**
- Member management and **invite links** (token-based)
- Per-channel real-time chat

### Calls
- **Voice & video calls** over **WebRTC** (peer-to-peer, mesh topology for groups)
- Call log history

### Experience
- **5 themes** (Light, Dark, Midnight, Solarized, Forest) + 6 accent colors, with an anti-FOUC bootstrap
- Customizable **avatars**: photo upload, gradient colors, or **DiceBear** generated avatars (16 styles, infinite variations)
- Fully **responsive** (mobile / tablet / desktop)

### Auth & Security
- Email/password authentication via **better-auth** (sessions, password reset)
- **Helmet** security headers, **rate limiting** (throttler), CORS allowlist
- Optional **Cloudflare R2** (S3-compatible) for durable file storage

---

## Tech Stack & Why

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Next.js 16 (App Router) + React 19 | File-based routing, RSC, great DX and easy deployment |
| **State** | Zustand | Minimal, hook-based global state without Redux boilerplate |
| **Styling** | Tailwind CSS v4 + CSS variables | Utility-first speed + a runtime-switchable theme system |
| **Backend** | NestJS 11 | Modular, opinionated, DI-based — scales cleanly as features grow |
| **ORM** | Prisma 7 | Type-safe queries and migrations from a single schema (15 models) |
| **Database** | PostgreSQL 16 | Relational integrity for users, messages, communities |
| **Real-time** | Socket.IO | Rooms & reconnection handling for chat and presence |
| **Calls** | WebRTC | Low-latency P2P audio/video without routing media through a server |
| **Auth** | better-auth | Modern session-based auth with a clean TS API |
| **Infra** | Docker Compose + Nginx | One-command spin-up; Nginx reverse-proxies `/api` and `/` |
| **CI** | GitHub Actions | Lint + tests (backend) and lint + build (frontend) on every push |

---

## Architecture

```mermaid
flowchart LR
    B["Browser — Next.js / React"]
    N["Nginx reverse proxy :80"]
    FE["Next.js server"]
    API["NestJS API + Socket.IO"]
    DB[("PostgreSQL")]
    R2[("Cloudflare R2 — optional")]

    B -->|"HTTP /"| N
    B -->|"HTTP /api"| N
    N -->|"/"| FE
    N -->|"/api"| API
    B <-->|"WebSocket (chat, presence)"| API
    API --> DB
    API --> R2
    B <-->|"WebRTC P2P (voice/video)"| B
```

**Repo layout**

```
Saturn/
├── backend/          # NestJS API (auth, chat, communities, conversations,
│   ├── src/          #   friends, messages, upload, users, gateway)
│   └── prisma/       # Schema (15 models) + migrations
├── frontend-web/     # Next.js App Router
│   ├── app/          # Pages: chat, communities, friends, calls, profile, auth
│   ├── components/   # AppShell, Avatar, modals, AuthLayout, …
│   └── store/        # Zustand stores (chat, theme)
├── nginx/            # Reverse-proxy config
└── docker-compose.yml
```

---

## Getting Started

**Prerequisites:** Node.js 20+, npm, Docker & Docker Compose.

```bash
git clone https://github.com/Franckprivat/Saturn.git saturn
cd saturn
```

Generate a session secret for `BETTER_AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Option A — Docker Compose (recommended)

Uses **one env file: `.env` at the repo root**. Compose reads it for the Postgres credentials and passes it to the `backend` and `frontend-web` containers.

```bash
cp .env.example .env
#   -> set POSTGRES_USER / POSTGRES_PASSWORD, the same values in DATABASE_URL
#      and BETTER_AUTH_DATABASE_URL (host stays `db:5432`), and BETTER_AUTH_SECRET

docker compose up -d --build   # db + backend + frontend + nginx
```

| URL | Service |
|-----|---------|
| http://localhost | App through Nginx (use this one) |
| http://localhost:3000 | Next.js directly |
| http://localhost:3001 | NestJS API directly |

Postgres is exposed on `127.0.0.1:5433` for local tools. Stop with `docker compose down` (add `-v` to wipe the database).

### Option B — Run locally (hot reload, no containers for the apps)

Postgres still runs in Docker; the API and frontend run on your machine.

| Env file | Read by | Notes |
|----------|---------|-------|
| `.env` (repo root) | `docker compose` (db service) | Postgres user / password / db name |
| `backend/.env` | NestJS + Prisma (`dotenv`) | Same keys as `.env.example`, but the DB host is **`localhost:5433`**, not `db:5432` |
| `frontend-web/.env.local` | Next.js | Optional — defaults to the API on `http://localhost:3001` |

```bash
# 1. Database only (uses the root .env)
cp .env.example .env
docker compose up -d db

# 2. Backend
cd backend
cp ../.env.example .env
#   -> same credentials as the root .env, but point DATABASE_URL and
#      BETTER_AUTH_DATABASE_URL at localhost:5433 instead of db:5432
npm install
npx prisma migrate deploy
npm run start:dev    # http://localhost:3001

# 3. Frontend (new terminal)
cd frontend-web
npm install
npm run dev          # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes | Postgres credentials |
| `DATABASE_URL` | yes | Prisma connection string |
| `BETTER_AUTH_DATABASE_URL` | yes | Auth DB (same database, without `?schema=public`) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret |
| `BETTER_AUTH_URL` | yes | Public URL of the API (`http://localhost:3001`) |
| `ALLOWED_ORIGINS` | yes | CORS allowlist |
| `PORT` | no | API port (default `3001`) |
| `SMTP_*` | no | Email (password reset) |
| `R2_*` | no | Cloudflare R2 file storage (falls back to local disk) |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_AUTH_URL` | no | Frontend → API URLs (set by Compose; default `http://localhost:3001`) |

---

## Tests & Quality

```bash
cd backend && npm test         # Jest unit tests
cd backend && npm run lint:ci  # ESLint (no auto-fix)
cd frontend-web && npm run build
```

CI runs lint + tests on every push via GitHub Actions.

---

## What I Learned

- **Real-time at scale** — designing Socket.IO rooms for DMs, groups and community channels, plus presence and read receipts.
- **WebRTC from scratch** — signalling over WebSockets and a mesh topology for multi-party calls, without an SFU.
- **A runtime theme system** — driving the whole UI from CSS variables so 5 themes switch live, including an anti-FOUC bootstrap script to avoid a flash on reload.
- **Containerized DX** — reproducible environments with Docker Compose + Nginx, and debugging real-world issues (port conflicts, volume permissions, stale build caches).
- **Schema-first modelling** — 15 related Prisma models with safe migrations on non-empty tables.

---

## Roadmap

- [ ] Server-side persistence for the call log
- [ ] Push notifications
- [ ] Community roles & moderation
- [ ] E2E tests (Playwright)
- [ ] Message search

---

## Author

**Franck** <!-- TODO: nom complet --> — _Looking for a work-study (alternance) in software development._

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)](https://github.com/Franckprivat)
<!-- TODO: badge LinkedIn
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/TON-PROFIL)
-->

---

<div align="center">
<sub>Built with NestJS, Next.js & a lot of WebSockets.</sub>
</div>
