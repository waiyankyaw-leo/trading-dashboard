import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { tickerRoutes } from "./routes/tickerRoutes.js";
import { historyRoutes } from "./routes/historyRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { alertRoutes } from "./routes/alertRoutes.js";

export async function buildApp() {
    const fastify = Fastify({
        logger: process.env.NODE_ENV !== "test",
    });

    await fastify.register(cors, {
        origin: (origin, cb) => {
            // FRONTEND_URL may be a comma-separated list for multi-env (prod + preview)
            const allowedList = (process.env.FRONTEND_URL ?? "http://localhost:3000")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (!origin || allowedList.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
                cb(null, true);
            } else {
                cb(new Error("CORS: origin not allowed"), false);
            }
        },
        credentials: true,
    });

    await fastify.register(cookie);

    // Register routes
    await fastify.register(authRoutes);
    await fastify.register(tickerRoutes);
    await fastify.register(historyRoutes);
    await fastify.register(alertRoutes);

    // Health check
    fastify.get("/api/health", async () => ({
        status: "ok",
        ts: Date.now(),
        uptime: process.uptime(),
    }));

    return fastify;
}
