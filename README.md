# TradeDash — Real-Time Trading Dashboard

A full-stack trading dashboard that streams live simulated market data, renders interactive candlestick charts, and lets users set persistent price alerts — built as a submission for the Frontend/Fullstack Coding Challenge.

**Live demo:** [https://trading-dashboard-xi-two.vercel.app](https://trading-dashboard-xi-two.vercel.app)

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

Everything in the challenge scope is covered, including all four bonus features:

| Requirement | Status | How it's done |
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
| **Bonus: User Authentication** | ✅ | Better Auth + PostgreSQL, HTTP-only session cookies |
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
│  Better Auth Client      │                │  PostgreSQL (Railway)    │
└──────────────────────────┘                └──────────────────────────┘
```

**How data flows:**

1. The `MarketSimulator` generates price ticks every second using Geometric Brownian Motion.
2. Ticks are emitted via EventEmitter → the WebSocket server broadcasts them to subscribed clients.
3. Each tick updates rolling OHLCV bars (1m through 1d) in memory, which power the history API.
4. The frontend receives ticks and pushes them into a Zustand store → the chart updates via `series.update()`.
5. On load, the history endpoint seeds the chart with up to 500 candles; live ticks continue seamlessly from there.
6. Price alerts are persisted in PostgreSQL, armed in the WS engine on connect, and fired as `ALERT` frames when crossed.

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm 9+**
- A **PostgreSQL 14+** instance (Railway Postgres, or any local Postgres)
- Docker & Docker Compose v2 *(optional — for containerised run)*

### 1. Clone & install

```bash
git clone https://github.com/waiyankyaw-leo/trading-dashboard.git
cd trading-dashboard
npm install   # installs all workspaces from the root lockfile
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` (see [`backend/.env.example`](backend/.env.example) for all options):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres
BETTER_AUTH_SECRET=<generate with: openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
TICK_INTERVAL_MS=1000
```

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env` (see [`frontend/.env.example`](frontend/.env.example) for all options):

```env
# Leave blank for local dev — Vite proxy handles /api and /ws automatically
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

> In **production** (Vercel), only `VITE_WS_URL` is needed. HTTP requests use relative URLs proxied by `vercel.json`.

### 4. Run database migrations

Migrations run automatically on server startup. To trigger them manually:

```bash
cd backend
npm run db:migrate
```

### 5. Start the backend

```bash
cd backend
npm run dev   # http://localhost:4000
```

### 6. Start the frontend

```bash
cd frontend
npm run dev   # http://localhost:3000 (proxies /api and /ws to :4000)
```

### 7. Docker (both services)

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
# Backend — 49 tests covering services, routes, and WebSocket
cd backend && npm test

# Frontend — 12 tests covering store logic and components
cd frontend && npm test
```

### What's tested

| Area | Test file | Tests | What's covered |
|---|---|:---:|---|
| Market Simulator | `marketSimulator.test.ts` | 12 | GBM bounds, tick shape, event emission |
| Ticker Service | `tickerService.test.ts` | 8 | List all, single lookup, invalid symbols |
| History Service | `historyService.test.ts` | 12 | OHLCV generation, cache hits, chronological order |
| REST Routes | `integration/routes.test.ts` | 15 | Health, tickers, history, auth-guarded alerts |
| WebSocket | `integration/websocket.test.ts` | 2 | SUBSCRIBE → TICK streaming, invalid JSON handling |
| FE Store | `tickerStore.test.ts` | 7 | Tick application, buffer limits, alerts, snapshots |
| FE Components | `PriceChange.test.tsx`, `Spinner.test.tsx` | 5 | Rendering, colour coding |

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

Auth is handled by Better Auth backed by PostgreSQL. Sessions are stored server-side and delivered as HTTP-only cookies — no tokens ever touch `localStorage`, which removes the XSS attack surface entirely. CORS and CSRF are locked down via trusted origins. Users can register, log in, and access protected routes.

### 2. History Caching

Historical OHLCV data is cached with `node-cache` at a 60-second TTL. Cache keys include the symbol, interval, limit, and a live-bar fingerprint, so repeated requests are fast while the active candle still refreshes in real time.

### 3. Price Threshold Alerts

The full alert lifecycle works end-to-end: create an alert via the REST API or by right-clicking the chart → it's saved to PostgreSQL → armed in the WebSocket alert engine when a client connects → rendered as a draggable line on the chart → fires once when the price crosses the threshold → triggers a toast notification with an auto-dismiss countdown. Alerts deduplicate across multiple tabs on both server and client.

### 4. Kubernetes Manifests

The `k8s/` folder has everything needed to run this on a cluster:
- `namespace.yaml` — `tradedash` namespace
- `backend-deployment.yaml` — Deployment (2 replicas), Service (ClusterIP), HPA (CPU 70%, max 5)
- `frontend-deployment.yaml` — Deployment + Service
- `backend-config.yaml` — ConfigMap + Secret
- `ingress.yaml` — Nginx Ingress with WebSocket timeout annotations

---

## Assumptions & Trade-offs

| Decision | Reasoning |
|---|---|
| **In-memory market data** | Price ticks and OHLCV bars live in memory. A production system would use TimescaleDB or InfluxDB, but that's out of scope here. |
| **Geometric Brownian Motion** | GBM with per-ticker volatility gives realistic random walks rather than flat noise. Crypto volatility is slightly damped for readability. |
| **Seeded historical bars** | Deterministic hash-based generation keeps chart history stable across page refreshes, with regime bias, realistic body/wick ratios, and mean reversion baked in. |
| **No ORM** | Better Auth manages its own schema. Alert queries use raw `pg` with parameterised statements — no SQL injection risk. |
| **HTTP-only session cookies** | Safer than JWT in localStorage. For the cross-origin Vercel ↔ Railway deployment, cookies use `SameSite=None; Secure`. |
| **Alerts fire once** | An alert triggers once and is marked `triggered_at` in the DB. It won't re-fire and is deduplicated across browser tabs. |
| **No rate-limiting** | Fine for a demo. Production would add `@fastify/rate-limit`. |

---

## Deployment

### Option A: Docker Compose (local / VM)

```bash
docker compose up --build
```

### Option B: Vercel + Railway (recommended)

> This is a monorepo — one GitHub repo, with Railway and Vercel each targeting their own subfolder.

#### Step 1 — Database
Add a **Railway Postgres** service to your project. Railway automatically exposes `${{Postgres.DATABASE_URL}}` as a reference variable. Migrations run on first deploy — no manual SQL needed.

#### Step 2 — Backend (Railway)
1. New Project → **Deploy from GitHub repo** → select this repo.
2. Railway picks up `railway.json` automatically (build + start commands are pre-configured).
3. Set these environment variables **(no quotes)**:
   - `DATABASE_URL` — `${{Postgres.DATABASE_URL}}` (Railway Postgres reference)
   - `BETTER_AUTH_SECRET` — `openssl rand -hex 32`
   - `BETTER_AUTH_URL` — `https://<your-railway-domain>` (shown after first deploy)
   - `FRONTEND_URL` — `https://<your-vercel-domain>` (update after Step 3)
   - `NODE_ENV` — `production`
4. Deploy — Railway runs `migrate.js` then `server.js`, and handles TLS + WebSocket upgrades automatically.

#### Step 3 — Frontend (Vercel)
1. Import the repo → set **Root Directory = `frontend`**.
2. Add one environment variable:
   ```
   VITE_WS_URL=wss://<your-railway-domain>
   ```
   > `VITE_API_URL` is not needed — `vercel.json` already proxies `/api/*` to Railway, keeping cookies first-party.
3. Deploy → copy the Vercel URL → go back to Railway and update `FRONTEND_URL`.

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
│   │   ├── lib/auth.ts               # Better Auth + PostgreSQL config
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
