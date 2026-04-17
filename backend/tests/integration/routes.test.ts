import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function makeApp(): Promise<FastifyInstance> {
    const app = await buildApp();
    await app.ready();
    return app;
}

// ── /api/health ───────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
    let app: FastifyInstance;
    beforeAll(async () => { app = await makeApp(); });
    afterAll(async () => { await app.close(); });

    it("returns 200 with status ok", async () => {
        const res = await app.inject({ method: "GET", url: "/api/health" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ status: "ok" });
    });
});

// ── /api/tickers ──────────────────────────────────────────────────────────────

describe("GET /api/tickers", () => {
    let app: FastifyInstance;
    beforeAll(async () => { app = await makeApp(); });
    afterAll(async () => { await app.close(); });

    it("returns an array of ticker summaries", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers" });
        expect(res.statusCode).toBe(200);
        const tickers = res.json();
        expect(Array.isArray(tickers)).toBe(true);
        expect(tickers.length).toBeGreaterThan(0);
        const first = tickers[0];
        expect(first).toHaveProperty("symbol");
        expect(first).toHaveProperty("name");
    });

    it("GET /api/tickers/:symbol returns a single ticker", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ symbol: "AAPL" });
    });

    it("GET /api/tickers/:symbol returns 404 for unknown symbol", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/FAKE" });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toHaveProperty("error");
    });
});

// ── /api/tickers/:symbol/history ──────────────────────────────────────────────

describe("GET /api/tickers/:symbol/history", () => {
    let app: FastifyInstance;
    beforeAll(async () => { app = await makeApp(); });
    afterAll(async () => { await app.close(); });

    it("returns OHLCV bars with correct shape", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL/history?interval=1m&limit=10" });
        expect(res.statusCode).toBe(200);
        const bars = res.json();
        expect(Array.isArray(bars)).toBe(true);
        expect(bars.length).toBeGreaterThan(0);
        const bar = bars[0];
        expect(typeof bar.ts).toBe("number");
        expect(typeof bar.open).toBe("number");
        expect(typeof bar.high).toBe("number");
        expect(typeof bar.low).toBe("number");
        expect(typeof bar.close).toBe("number");
        expect(typeof bar.volume).toBe("number");
    });

    it("respects the limit param", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL/history?interval=1m&limit=20" });
        expect(res.statusCode).toBe(200);
        // Includes current forming bar so may be limit+1
        expect(res.json().length).toBeLessThanOrEqual(21);
    });

    it("returns 400 for invalid interval", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL/history?interval=2m" });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toHaveProperty("error");
    });

    it("returns 400 for non-numeric limit", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL/history?limit=abc" });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toHaveProperty("error");
    });

    it("returns 400 for negative limit", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/AAPL/history?limit=-5" });
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown symbol", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tickers/FAKE/history?interval=1m&limit=10" });
        expect(res.statusCode).toBe(404);
    });

    it("accepts all valid intervals", async () => {
        const intervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
        for (const interval of intervals) {
            const res = await app.inject({ method: "GET", url: `/api/tickers/AAPL/history?interval=${interval}&limit=5` });
            expect(res.statusCode, `interval ${interval} should return 200`).toBe(200);
        }
    });
});

// ── /api/alerts — unauthenticated ─────────────────────────────────────────────

describe("Alert routes — unauthenticated", () => {
    let app: FastifyInstance;
    beforeAll(async () => { app = await makeApp(); });
    afterAll(async () => { await app.close(); });

    it("GET /api/alerts returns 401 without session", async () => {
        const res = await app.inject({ method: "GET", url: "/api/alerts" });
        expect(res.statusCode).toBe(401);
    });

    it("POST /api/alerts returns 401 without session", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/alerts",
            payload: { symbol: "AAPL", above: 200 },
        });
        expect(res.statusCode).toBe(401);
    });

    it("PATCH /api/alerts/:id returns 401 without session", async () => {
        const res = await app.inject({ method: "PATCH", url: "/api/alerts/some-id", payload: { above: 210 } });
        expect(res.statusCode).toBe(401);
    });

    it("DELETE /api/alerts/:id returns 401 without session", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/alerts/some-id" });
        expect(res.statusCode).toBe(401);
    });
});
