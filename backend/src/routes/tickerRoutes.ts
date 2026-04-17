import type { FastifyInstance } from "fastify";
import { listTickers, getTicker } from "../services/tickerService.js";

export async function tickerRoutes(fastify: FastifyInstance) {
    fastify.get("/api/tickers", async (_req, reply) => {
        return reply.send(listTickers());
    });

    fastify.get<{ Params: { symbol: string } }>("/api/tickers/:symbol", async (req, reply) => {
        const ticker = getTicker(req.params.symbol);
        if (!ticker) {
            return reply.status(404).send({ error: "Ticker not found" });
        }
        return reply.send(ticker);
    });
}
