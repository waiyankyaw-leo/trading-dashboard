import { betterAuth } from "better-auth";
import { dbPool } from "./db.js";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
        "BETTER_AUTH_SECRET must be set in production. Generate one with: openssl rand -hex 32",
    );
}

const trustedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// When the frontend and backend live on different domains (e.g. Vercel + Railway),
// the session cookie must be cross-site capable.
const crossSiteCookies = process.env.NODE_ENV === "production";

export const auth = betterAuth({
    database: dbPool,
    secret,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
    },
    trustedOrigins,
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 1, // 1 hour
        },
    },
    advanced: {
        defaultCookieAttributes: crossSiteCookies
            ? { sameSite: "none", secure: true }
            : undefined,
    },
    basePath: "/api/auth",
});
