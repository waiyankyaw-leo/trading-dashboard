import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { isValidSymbol } from "../services/tickerService.js";
import { createAlert, deleteAlert, listActiveAlertsByUser, updateAlert } from "../services/alertRepository.js";

const createAlertSchema = z.object({
    symbol: z.string().trim().min(1),
    above: z.number().finite().optional(),
    below: z.number().finite().optional(),
}).refine((value) => value.above !== undefined || value.below !== undefined, {
    message: "Provide 'above' and/or 'below' threshold",
}).refine((value) => value.above === undefined || value.below === undefined || value.above > value.below, {
    message: "'above' must be greater than 'below' when both are provided",
});

function getStorageErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42P01") {
        return "Alert storage is not ready. Run the alert migration first.";
    }
    return "Alert request failed";
}

export async function alertRoutes(fastify: FastifyInstance) {
    fastify.get("/api/alerts", { preHandler: requireAuth }, async (req, reply) => {
        try {
            const userId = req.session?.user.id;
            if (!userId) return reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });

            const alerts = await listActiveAlertsByUser(userId);
            return reply.send(alerts);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: getStorageErrorMessage(error), code: "ALERTS_FETCH_FAILED" });
        }
    });

    fastify.post("/api/alerts", { preHandler: requireAuth }, async (req, reply) => {
        const parsed = createAlertSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: parsed.error.issues[0]?.message ?? "Invalid alert payload",
                code: "INVALID_ALERT",
            });
        }

        const userId = req.session?.user.id;
        if (!userId) return reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });

        const symbol = parsed.data.symbol.toUpperCase();
        if (!isValidSymbol(symbol)) {
            return reply.status(400).send({ error: `Unknown symbol: ${parsed.data.symbol}`, code: "INVALID_SYMBOL" });
        }

        try {
            const alert = await createAlert({
                userId,
                symbol,
                above: parsed.data.above,
                below: parsed.data.below,
            });

            return reply.status(201).send(alert);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: getStorageErrorMessage(error), code: "ALERT_CREATE_FAILED" });
        }
    });

    fastify.delete("/api/alerts/:alertId", { preHandler: requireAuth }, async (req, reply) => {
        const params = z.object({ alertId: z.string().min(1) }).safeParse(req.params);
        if (!params.success) {
            return reply.status(400).send({ error: "Missing alert id", code: "INVALID_ALERT_ID" });
        }

        const userId = req.session?.user.id;
        if (!userId) return reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });

        try {
            const removed = await deleteAlert(params.data.alertId, userId);
            if (!removed) {
                return reply.status(404).send({ error: "Alert not found", code: "ALERT_NOT_FOUND" });
            }

            return reply.status(204).send();
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: getStorageErrorMessage(error), code: "ALERT_DELETE_FAILED" });
        }
    });

    fastify.patch("/api/alerts/:alertId", { preHandler: requireAuth }, async (req, reply) => {
        const params = z.object({ alertId: z.string().min(1) }).safeParse(req.params);
        if (!params.success) {
            return reply.status(400).send({ error: "Missing alert id", code: "INVALID_ALERT_ID" });
        }

        const bodySchema = z.object({
            above: z.number().finite().optional(),
            below: z.number().finite().optional(),
        }).refine((v) => v.above !== undefined || v.below !== undefined, {
            message: "Provide 'above' or 'below'",
        });

        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload", code: "INVALID_ALERT" });
        }

        const userId = req.session?.user.id;
        if (!userId) return reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });

        try {
            const updated = await updateAlert(params.data.alertId, userId, parsed.data.above, parsed.data.below);
            if (!updated) {
                return reply.status(404).send({ error: "Alert not found", code: "ALERT_NOT_FOUND" });
            }
            return reply.send(updated);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: getStorageErrorMessage(error), code: "ALERT_UPDATE_FAILED" });
        }
    });
}
