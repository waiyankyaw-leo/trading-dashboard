import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../../src/app.js";
import { createWsServer } from "../../src/websocket/wsServer.js";
import { simulator } from "../../src/services/marketSimulator.js";
import type { FastifyInstance } from "fastify";
import type { WebSocketServer } from "ws";

describe("WebSocket /ws smoke test", () => {
    let app: FastifyInstance;
    let wss: WebSocketServer;
    let port: number;

    beforeAll(async () => {
        app = await buildApp();
        await app.listen({ port: 0, host: "127.0.0.1" });
        const addr = app.server.address();
        if (!addr || typeof addr === "string") throw new Error("no address");
        port = addr.port;
        wss = createWsServer(app.server);
        simulator.start();
    });

    afterAll(async () => {
        simulator.stop();
        await new Promise<void>((resolve) => wss.close(() => resolve()));
        await app.close();
    });

    it("accepts SUBSCRIBE and streams TICK messages", async () => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            ws.once("open", () => resolve());
            ws.once("error", reject);
        });

        ws.send(JSON.stringify({ type: "SUBSCRIBE", symbols: ["AAPL"] }));

        const tick = await new Promise<{ type: string; symbol: string; price: number }>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("TICK not received")), 3500);
            ws.on("message", (raw) => {
                const msg = JSON.parse(raw.toString());
                if (msg.type === "TICK" && msg.symbol === "AAPL") {
                    clearTimeout(timer);
                    resolve(msg);
                }
            });
        });

        expect(tick.type).toBe("TICK");
        expect(tick.symbol).toBe("AAPL");
        expect(typeof tick.price).toBe("number");

        ws.close();
    });

    it("rejects invalid JSON with an ERROR frame", async () => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            ws.once("open", () => resolve());
            ws.once("error", reject);
        });

        ws.send("not-json");

        const err = await new Promise<{ type: string; code: string }>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("ERROR not received")), 2000);
            ws.on("message", (raw) => {
                const msg = JSON.parse(raw.toString());
                if (msg.type === "ERROR") {
                    clearTimeout(timer);
                    resolve(msg);
                }
            });
        });

        expect(err.code).toBe("INVALID_JSON");
        ws.close();
    });
});
