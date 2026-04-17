import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getHistory, isValidInterval } from "../services/historyService.js";
import { simulator } from "../services/marketSimulator.js";

const historyQuerySchema = z.object({
    interval: z.string().optional().default("1m"),
    limit: z
        .string()
        .optional()
        .default("60")
        .transform((v) => parseInt(v, 10))
        .refine((n) => Number.isFinite(n) && n >= 1, { message: "limit must be a positive integer" }),
});

export async function historyRoutes(fastify: FastifyInstance) {
    fastify.get<{
        Params: { symbol: string };
        Querystring: { interval?: string; limit?: string };
    }>("/api/tickers/:symbol/history", async (req, reply) => {
        const parsed = historyQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid query params" });
        }

        const { symbol } = req.params;
        const { interval, limit } = parsed.data;

        if (!isValidInterval(interval)) {
            return reply.status(400).send({ error: "Invalid interval. Use: 1m, 5m, 15m, 1h, 4h, 1d" });
        }

        const historicalBars = simulator.getHistoricalBars(symbol.toUpperCase(), interval, limit);
        const currentBar = simulator.getCurrentBar(symbol.toUpperCase(), interval);
        const bars = getHistory(symbol, interval, limit, currentBar, historicalBars);
        if (!bars) {
            return reply.status(404).send({ error: "Ticker not found" });
        }

        return reply.send(bars);
    });
}
