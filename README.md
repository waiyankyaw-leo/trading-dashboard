# TradeDash — Real-Time Trading Dashboard

A full-stack, real-time trading dashboard that simulates live market data and displays interactive candlestick charts for multiple financial instruments — built as a Frontend/Fullstack Coding Challenge submission.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Bonus Features](#bonus-features)
- [Assumptions & Trade-offs](#assumptions--trade-offs)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Project Overview

TradeDash fulfils every scope requirement and all optional bonus features outlined in the challenge brief:

| Requirement | Status | Implementation |
|---|:---:|---|
| **Backend Service (Node.js)** | ✅ | Fastify 5 microservice with TypeScript |
| Simulates mock market data feed | ✅ | Geometric Brownian Motion with per-ticker volatility |
| Streams real-time price updates via WebSocket | ✅ | Raw `ws` library — `TICK`, `SNAPSHOT`, `ALERT` frames |
| REST API: list tickers | ✅ | `GET /api/tickers` |
| REST API: fetch historical price data | ✅ | `GET /api/tickers/:symbol/history` with 6 intervals |
| REST API: subscribe via WebSocket | ✅ | `SUBSCRIBE` / `UNSUBSCRIBE` message protocol |
| **Frontend Dashboard (React + TypeScript)** | ✅ | React 18 + Vite + TypeScript 5 |
| Displays list of tickers with live prices | ✅ | Sidebar with real-time price & change updates |
| Shows real-time chart for selected ticker | ✅ | TradingView Lightweight Charts (candlestick) with live bar updates |
| Allows switching between tickers | ✅ | Single-click selection, 6 interval buttons (1m–1d) |
| Basic styling and responsiveness | ✅ | Tailwind CSS, dark theme, resizable sidebar, mobile-friendly |
| **Architecture & Design** | ✅ | Monorepo with npm workspaces, clean separation |
| Microservices-friendly structure | ✅ | Separate backend/frontend builds, Docker Compose, K8s manifests |
| Clean code & separation of concerns | ✅ | Routes → Services → Repository pattern; Zustand + React Query split |
| Unit tests for backend logic | ✅ | 49 backend tests (Vitest) — services, routes, WebSocket |
| Docker containerization | ✅ | Workspace-aware multi-stage Dockerfiles |
| **Bonus: User Authentication** | ✅ | Better Auth + Supabase PostgreSQL, HTTP-only session cookies |
| **Bonus: History Caching** | ✅ | `node-cache` with 60 s TTL, composite cache keys |
| **Bonus: Price Threshold Alerts** | ✅ | Persisted alerts with draggable chart lines, toast notifications |
| **Bonus: Kubernetes Manifests** | ✅ | Namespace, Deployment, Service, HPA, ConfigMap, Secret, Ingress |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20, Fastify 5, TypeScript 5 |
| **WebSocket** | `ws` library (raw, no Socket.io) |
| **Auth** | Better Auth + PostgreSQL — HTTP-only session cookies |
| **Cache** | node-cache (60 s TTL, `useClones: false`) |
| **Frontend** | React 18, Vite 7, TypeScript 5 |
| **Charts** | TradingView Lightweight Charts 5 |
| **State** | Zustand (real-time ticks) + TanStack React Query (REST) |
| **Styling** | Tailwind CSS 3 (dark theme, responsive) |
| **Testing** | Vitest 4, Testing Library, Supertest |
| **Container** | Docker multi-stage builds, Docker Compose v2 |
| **Orchestration** | Kubernetes manifests (Deployment, HPA, Ingress) |
| **Monorepo** | npm workspaces with shared ESLint config |

---

## Architecture

```
Browser (Port 3000)                          Backend (Port 4000)
┌──────────────────────────┐                ┌──────────────────────────┐
│  React 18 + Vite         │  ── REST ────► │  Fastify 5 + TypeScript  │
│  TailwindCSS             │  ── WS ──────► │  ws WebSocket server     │
│  Lightweight Charts 5    │                │  Better Auth             │
│  Zustand + React Query   │                │  GBM Market Simulator    │
│  Better Auth Client      │                │  Supabase (PostgreSQL)   │
└──────────────────────────┘                └──────────────────────────┘
```

**Data flow:**

1. Backend's `MarketSimulator` uses Geometric Brownian Motion to generate realistic price ticks every 1 s.
2. Ticks are emitted via EventEmitter → WebSocket server broadcasts to subscribed clients.
3. Each tick updates rolling OHLCV bars (1m through 1d) in memory; these serve the history API.
4. Frontend subscribes on connect; ticks flow into Zustand store → chart updates via `series.update()`.
5. History endpoint seeds the chart with up to 500 candles; the live bar is seamlessly continued by WS ticks.
6. Alerts are persisted in PostgreSQL, loaded into the WS alert engine on connect, and fired as `ALERT` frames.

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm 9+**
- A **PostgreSQL 14+** instance (Railway Postgres, Supabase free tier, or local)
- Docker & Docker Compose v2 (optional, for containerized run)

### 1. Clone & install

```bash
git clone https://github.com/waiyankyaw-leo/trading-dashboard.git
cd trading-dashboard
npm install          # installs all workspaces from root lockfile
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
BETTER_AUTH_SECRET=<generate with: openssl rand -hex 32>
```

### 3. Run database migrations

Open the **Supabase SQL Editor** and run, in order:

1. `backend/auth-schema.sql` — creates Better Auth tables (`user`, `session`, `account`, `verification`).
2. `backend/migrations/001_create_price_alerts.sql` — creates the `price_alerts` table with partial indexes.

Or run the Better Auth CLI:

```bash
cd backend
npm run db:migrate
```

### 4. Start the backend

```bash
cd backend
npm run dev          # http://localhost:4000
```

### 5. Start the frontend

```bash
cd frontend
npm run dev          # http://localhost:3000 (proxies to :4000)
```

### 6. Docker (both services)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL and BETTER_AUTH_SECRET

docker compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:4000
```

---

## Running Tests

```bash
# Backend (49 tests — services, routes, WebSocket integration)
cd backend
npm test

# Frontend (12 tests — store, components)
cd frontend
npm test
```

### Test coverage breakdown

| Area | Test file | Tests | What's covered |
|---|---|:---:|---|
| Market Simulator | `marketSimulator.test.ts` | 12 | GBM bounds, tick shape, event emission, Gaussian distribution |
| Ticker Service | `tickerService.test.ts` | 8 | List all, get single, case-insensitive, invalid symbols |
| History Service | `historyService.test.ts` | 12 | OHLCV generation, interval validation, cache hits, chronological order |
| REST Routes | `integration/routes.test.ts` | 15 | Health, tickers, history params, auth-guarded alert endpoints |
| WebSocket | `integration/websocket.test.ts` | 2 | SUBSCRIBE → TICK streaming, invalid JSON → ERROR frame |
| FE Store | `tickerStore.test.ts` | 7 | Tick application, buffer limits, alerts, snapshots |
| FE Components | `PriceChange.test.tsx`, `Spinner.test.tsx` | 5 | Color coding, rendering |

---

## API Reference

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/health` | — | Liveness probe |
| `GET` | `/api/tickers` | — | List all tickers with latest price |
| `GET` | `/api/tickers/:symbol` | — | Single ticker detail |
| `GET` | `/api/tickers/:symbol/history` | — | OHLCV bars (`?interval=1m&limit=60`) |
| `POST` | `/api/auth/sign-up/email` | — | Register (Better Auth) |
| `POST` | `/api/auth/sign-in/email` | — | Login → sets HTTP-only session cookie |
| `POST` | `/api/auth/sign-out` | — | Logout → clears cookie |
| `GET` | `/api/auth/get-session` | — | Current session info |
| `GET` | `/api/alerts` | 🔒 | List active alerts for the logged-in user |
| `POST` | `/api/alerts` | 🔒 | Create a persisted alert |
| `PATCH` | `/api/alerts/:alertId` | 🔒 | Update alert thresholds |
| `DELETE` | `/api/alerts/:alertId` | 🔒 | Delete an alert |

**History intervals:** `1m`, `5m`, `15m`, `1h`, `4h`, `1d` — limit default `60`, max `500`.

---

## WebSocket Protocol

Connect to `ws://localhost:4000/ws`

### Client → Server

```jsonc
{ "type": "SUBSCRIBE",    "symbols": ["AAPL", "BTC-USD"] }
{ "type": "UNSUBSCRIBE",  "symbols": ["AAPL"] }
{ "type": "SET_ALERT",    "alertId": "...", "symbol": "TSLA", "above": 250 }
{ "type": "REMOVE_ALERT", "alertId": "..." }
```

### Server → Client

```jsonc
{ "type": "TICK",       "symbol": "AAPL", "price": 189.43, "change": 0.12, "changePercent": 0.063, "volume": 5000, "ts": 1713178800000 }
{ "type": "SNAPSHOT",   "symbol": "BTC-USD", "ticks": [ ... ] }
{ "type": "ALERT",      "alertId": "...", "symbol": "TSLA", "message": "TSLA crossed above 250.00 — current: 250.43", "price": 250.43 }
{ "type": "ERROR",      "code": "INVALID_SYMBOL", "message": "Unknown symbol: XYZ" }
{ "type": "SUBSCRIBED", "message": "Connected. ID: ..." }
```

---

## Bonus Features

### 1. User Authentication

Better Auth with PostgreSQL (Railway Postgres). Sessions stored server-side with HTTP-only cookies — **no tokens in `localStorage`**, eliminating XSS attack vectors. CSRF protection via trusted origins. Supports login, registration, and session-based route protection.

### 2. History Caching

`node-cache` with a 60-second TTL. Cache keys are composites of symbol, interval, limit, and a live-bar fingerprint — so identical requests hit the cache while still refreshing when the active candle changes.

### 3. Price Threshold Alerts

Full lifecycle: create via REST or chart right-click → persist in PostgreSQL → arm in the WebSocket alert engine → render as **draggable chart lines** with labels → fire once when the price crosses → toast notification with auto-dismiss countdown. Alerts deduplicate across multiple tabs on both server and client.

### 4. Kubernetes Manifests

Complete `k8s/` directory:
- `namespace.yaml` — `tradedash` namespace
- `backend-deployment.yaml` — Deployment (2 replicas), Service (ClusterIP), HPA (CPU 70%, max 5)
- `frontend-deployment.yaml` — Deployment + Service
- `backend-config.yaml` — ConfigMap + Secret
- `ingress.yaml` — Nginx Ingress with WebSocket timeout annotations

---

## Assumptions & Trade-offs

| Decision | Rationale |
|---|---|
| **In-memory market data** | Price ticks and OHLCV bars live in memory. Production would use TimescaleDB/InfluxDB — out of scope for this challenge. |
| **Geometric Brownian Motion** | GBM with per-ticker volatility produces realistic random walks instead of flat noise. Crypto volatility is slightly damped for demo readability. |
| **Seeded historical bars** | Deterministic hash-based generation ensures chart history is stable across refreshes, with regime bias, body/wick ratios, and mean reversion. |
| **No ORM** | Better Auth manages its own Postgres schema. Alert queries use raw `pg` with parameterized statements (SQL injection safe). |
| **HTTP-only session cookies** | More secure than JWT-in-localStorage. For cross-origin deployment (Vercel ↔ Railway), cookies use `SameSite=None; Secure`. |
| **Alerts fire once** | An alert triggers once and is marked `triggered_at` in the DB. Deduplicated across tabs on both server and client. |
| **No rate-limiting** | Acceptable for a demo; production would add `@fastify/rate-limit`. |

---

## Deployment

### Option A: Docker Compose (local / VM)

```bash
docker compose up --build
```

### Option B: Vercel (Frontend) + Railway (Backend) + Railway Postgres (Database)

> This is a **monorepo** — push one repo to GitHub; Railway and Vercel each consume their own slice using the settings below.

**Live demo:** [https://trading-dashboard-xi-two.vercel.app](https://trading-dashboard-xi-two.vercel.app)

#### Step 0 — Push to GitHub

```bash
git remote add origin https://github.com/<your-user>/tradedash.git
git push -u origin master
```

#### Step 1 — Database (Railway Postgres recommended)
1. Add a Railway Postgres service to your project → Railway auto-sets `${{Postgres.DATABASE_URL}}`.
2. Migrations run automatically on deploy via `migrate.js` — no manual SQL needed.

#### Step 2 — Railway (backend)
1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Select the repo. Railway auto-detects `railway.json` — no manual build/start config needed.
3. Add environment variables (**Variables** tab):
   - `DATABASE_URL` — `${{Postgres.DATABASE_URL}}` (Railway Postgres reference)
   - `BETTER_AUTH_SECRET` — `openssl rand -hex 32`
   - `BETTER_AUTH_URL` — `https://<your-railway-domain>` (shown after first deploy)
   - `FRONTEND_URL` — `https://<your-vercel-domain>` (update after Step 3)
   - `NODE_ENV` — `production`
4. Deploy. Railway runs `migrate.js` then `server.js` automatically and handles TLS + WebSocket upgrade.

#### Step 3 — Vercel (frontend)
1. Import the repo at [vercel.com](https://vercel.com). Set **Root Directory = `frontend`**.
2. Add environment variable:
   - `VITE_WS_URL` — `wss://<your-railway-domain>`
   > `VITE_API_URL` is **not needed** — `vercel.json` proxies `/api/*` to Railway so cookies are always first-party.
3. Deploy, then go back to Railway and update `FRONTEND_URL` with the Vercel production URL.
   > `frontend/vercel.json` is already configured with SPA rewrites, `/api` proxy, and security headers.

### Option C: Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend-config.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Project Structure

```
trading_project/
├── backend/
│   ├── src/
│   │   ├── config/tickers.ts         # Ticker definitions & seed prices
│   │   ├── lib/auth.ts               # Better Auth + Supabase config
│   │   ├── lib/db.ts                 # PostgreSQL pool
│   │   ├── middleware/authMiddleware.ts
│   │   ├── routes/                   # alertRoutes, authRoutes, historyRoutes, tickerRoutes
│   │   ├── services/
│   │   │   ├── marketSimulator.ts    # GBM simulator + OHLCV bucketing
│   │   │   ├── tickerService.ts      # Ticker lookups
│   │   │   ├── historyService.ts     # OHLCV history + cache
│   │   │   ├── alertService.ts       # In-memory alert engine
│   │   │   ├── alertRepository.ts    # PostgreSQL CRUD for alerts
│   │   │   └── cacheService.ts       # node-cache wrapper
│   │   ├── websocket/wsServer.ts     # WS server with pub/sub + alert delivery
│   │   ├── types/index.ts
│   │   ├── app.ts                    # Fastify setup
│   │   └── server.ts                 # Entry point
│   ├── tests/                        # 49 Vitest tests
│   ├── migrations/                   # SQL migration files
│   ├── auth-schema.sql               # Better Auth schema
│   └── Dockerfile                    # Multi-stage, workspace-aware
├── frontend/
│   ├── src/
│   │   ├── api/                      # Axios client, REST API functions
│   │   ├── components/
│   │   │   ├── alerts/AlertBanner.tsx # Toast notification system
│   │   │   ├── chart/                # PriceChart, ChartContainer, context menu, hooks
│   │   │   ├── layout/               # Header (with notification bell), Sidebar
│   │   │   ├── ticker/TickerRow.tsx   # Instrument list item
│   │   │   └── ui/                   # Spinner, ProtectedRoute, ErrorBoundary, etc.
│   │   ├── hooks/                    # useWebSocket, useTickerData, useAlerts
│   │   ├── lib/                      # authClient, chartTheme, formatters
│   │   ├── pages/                    # LoginPage, Dashboard
│   │   ├── store/tickerStore.ts      # Zustand real-time state
│   │   └── types/index.ts
│   ├── nginx.conf                    # Production static + API/WS proxy
│   └── Dockerfile
├── k8s/                              # Kubernetes manifests
├── packages/eslint-config/           # Shared ESLint config
├── docker-compose.yml
└── package.json                      # npm workspace root
```
