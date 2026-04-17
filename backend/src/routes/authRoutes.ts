import type { FastifyInstance } from "fastify";
import { auth } from "../lib/auth.js";

export async function authRoutes(fastify: FastifyInstance) {
    fastify.all("/api/auth/*", async (req, reply) => {
        const url = new URL(
            req.url,
            process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
        );

        const headers = new Headers();
        Object.entries(req.headers).forEach(([key, value]) => {
            if (value !== undefined) {
                headers.set(key, Array.isArray(value) ? value.join(", ") : value);
            }
        });

        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const body = hasBody && req.body != null ? JSON.stringify(req.body) : undefined;
        if (body) headers.set("content-type", "application/json");

        const response = await auth.handler(
            new Request(url, { method: req.method, headers, body }),
        );

        reply.status(response.status);
        response.headers.forEach((value, key) => void reply.header(key, value));

        return reply.send(await response.text());
    });
}

