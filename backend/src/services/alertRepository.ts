import { randomUUID } from "crypto";
import { dbPool } from "../lib/db.js";

interface AlertRow {
    id: string;
    user_id: string;
    symbol: string;
    above: number | null;
    below: number | null;
    created_at: Date | string;
    triggered_at: Date | string | null;
}

export interface StoredAlert {
    id: string;
    userId: string;
    symbol: string;
    above: number | null;
    below: number | null;
    createdAt: string;
    triggeredAt: string | null;
}

interface CreateAlertInput {
    userId: string;
    symbol: string;
    above?: number;
    below?: number;
}

function mapAlert(row: AlertRow): StoredAlert {
    return {
        id: row.id,
        userId: row.user_id,
        symbol: row.symbol,
        above: row.above,
        below: row.below,
        createdAt: new Date(row.created_at).toISOString(),
        triggeredAt: row.triggered_at ? new Date(row.triggered_at).toISOString() : null,
    };
}

export async function listActiveAlertsByUser(userId: string): Promise<StoredAlert[]> {
    const result = await dbPool.query<AlertRow>(
        `
        SELECT id, user_id, symbol, above, below, created_at, triggered_at
        FROM price_alerts
        WHERE user_id = $1 AND triggered_at IS NULL
        ORDER BY created_at DESC
        `,
        [userId],
    );

    return result.rows.map(mapAlert);
}

export async function findActiveAlertById(userId: string, alertId: string): Promise<StoredAlert | null> {
    const result = await dbPool.query<AlertRow>(
        `
        SELECT id, user_id, symbol, above, below, created_at, triggered_at
        FROM price_alerts
        WHERE id = $1 AND user_id = $2 AND triggered_at IS NULL
        LIMIT 1
        `,
        [alertId, userId],
    );

    return result.rows[0] ? mapAlert(result.rows[0]) : null;
}

export async function createAlert(input: CreateAlertInput): Promise<StoredAlert> {
    const id = randomUUID();
    const result = await dbPool.query<AlertRow>(
        `
        INSERT INTO price_alerts (id, user_id, symbol, above, below)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, symbol, above, below, created_at, triggered_at
        `,
        [id, input.userId, input.symbol, input.above ?? null, input.below ?? null],
    );

    return mapAlert(result.rows[0]);
}

export async function deleteAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await dbPool.query(
        `
        DELETE FROM price_alerts
        WHERE id = $1 AND user_id = $2
        `,
        [alertId, userId],
    );

    return (result.rowCount ?? 0) > 0;
}

export async function updateAlert(
    alertId: string,
    userId: string,
    above: number | undefined,
    below: number | undefined,
): Promise<StoredAlert | null> {
    const result = await dbPool.query<AlertRow>(
        `
        UPDATE price_alerts
        SET above = $3, below = $4
        WHERE id = $1 AND user_id = $2 AND triggered_at IS NULL
        RETURNING id, user_id, symbol, above, below, created_at, triggered_at
        `,
        [alertId, userId, above ?? null, below ?? null],
    );

    return result.rows[0] ? mapAlert(result.rows[0]) : null;
}

export async function markAlertTriggered(alertId: string): Promise<void> {
    await dbPool.query(
        `
        UPDATE price_alerts
        SET triggered_at = NOW()
        WHERE id = $1 AND triggered_at IS NULL
        `,
        [alertId],
    );
}