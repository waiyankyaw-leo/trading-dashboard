import "dotenv/config";
import { buildApp } from "./app.js";
import { createWsServer } from "./websocket/wsServer.js";
import { simulator } from "./services/marketSimulator.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

async function main() {
    const fastify = await buildApp();

    // Start the HTTP server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });

    // Attach WebSocket server to the same HTTP server
    const httpServer = fastify.server;
    createWsServer(httpServer);

    // Start the market data simulator
    simulator.start();
    console.log(`Market simulator started — ticking every ${process.env.TICK_INTERVAL_MS ?? 1000}ms`);

    // Graceful shutdown
    const shutdown = async () => {
        console.log("Shutting down...");
        simulator.stop();
        await fastify.close();
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
