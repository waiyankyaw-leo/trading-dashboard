import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
        reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });
        return;
    }

    req.session = session;
}
