/**
 * Database migration runner
 * Runs auth-schema.sql (Better Auth tables) then all migrations/ files in order.
 * All statements are idempotent (IF NOT EXISTS) so this is safe to run on every deploy.
 */
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
});

async function run() {
    const client = await pool.connect();
    try {
        // 1. Better Auth core tables
        const authSchema = readFileSync(join(__dirname, "../../auth-schema.sql"), "utf8");
        console.log("→ Running auth-schema.sql …");
        await client.query(authSchema);
        console.log("  ✓ auth-schema.sql applied");

        // 2. App migrations — run in filename order (001_, 002_, …)
        const migrationsDir = join(__dirname, "../../migrations");
        const files = readdirSync(migrationsDir)
            .filter((f) => f.endsWith(".sql"))
            .sort();

        for (const file of files) {
            const sql = readFileSync(join(migrationsDir, file), "utf8");
            console.log(`→ Running migrations/${file} …`);
            await client.query(sql);
            console.log(`  ✓ ${file} applied`);
        }

        console.log("\nAll migrations complete.");
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.warn("Migration warning (server will still start):", err.message);
    process.exit(0);
});
