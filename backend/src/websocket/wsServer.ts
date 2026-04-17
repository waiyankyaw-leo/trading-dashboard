import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { randomUUID } from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import { simulator } from "../services/marketSimulator.js";
import { isValidSymbol } from "../services/tickerService.js";
import { addAlert, removeConnectionAlert, removeConnectionAlerts, checkAlerts, setConnectionAlerts } from "../services/alertService.js";
import { auth } from "../lib/auth.js";
import { createAlert, deleteAlert, findActiveAlertById, listActiveAlertsByUser, markAlertTriggered } from "../services/alertRepository.js";
import type { WsIncomingMessage, WsOutgoingMessage } from "../types/index.js";

interface TrackedClient {
    ws: WebSocket;
    id: string;
    subscriptions: Set<string>;
    userId?: string;
}

const clients = new Map<string, TrackedClient>();

export function createWsServer(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (ws: WebSocket, req) => {
        const id = randomUUID();
        const client: TrackedClient = { ws, id, subscriptions: new Set() };
        clients.set(id, client);

        send(ws, { type: "SUBSCRIBED", message: `Connected. ID: ${id}` });

        ws.on("message", (raw) => {
            void handleMessage(client, raw.toString());
        });

        ws.on("close", () => {
            clients.delete(id);
            removeConnectionAlerts(id);
        });

        ws.on("error", () => {
            clients.delete(id);
            removeConnectionAlerts(id);
        });

        void hydrateClientAlerts(client, req.headers);
    });

    // Broadcast ticks to subscribed clients
    simulator.on("tick", (tick) => {
        const alerts = checkAlerts(tick);

        for (const [, client] of clients) {
            if (!client.subscriptions.has(tick.symbol)) continue;
            if (client.ws.readyState !== WebSocket.OPEN) continue;

            send(client.ws, {
                type: "TICK",
                symbol: tick.symbol,
                price: tick.price,
                change: tick.change,
                changePercent: tick.changePercent,
                volume: tick.volume,
                ts: tick.ts,
            });
        }

        for (const alert of alerts) {
            const ownerClient = clients.get(alert.connectionId);
            const ownerUserId = ownerClient?.userId;

            // Deliver the ALERT only to the originating tab so the user sees a
            // single notification even if they have multiple tabs open.
            if (ownerClient?.ws.readyState === WebSocket.OPEN) {
                send(ownerClient.ws, {
                    type: "ALERT",
                    alertId: alert.alertId,
                    symbol: tick.symbol,
                    message: alert.message,
                    price: tick.price,
                });
            }

            // Sweep the same rule from any sibling connection of the same user
            // (e.g. other tabs, or StrictMode double-mount) so the alert does
            // not re-fire on a future tick from a different connection.
            if (ownerUserId) {
                for (const [, client] of clients) {
                    if (client.id === alert.connectionId) continue;
                    if (client.userId !== ownerUserId) continue;
                    removeConnectionAlert(client.id, alert.alertId);
                }
            }

            void markAlertTriggered(alert.alertId).catch(() => undefined);
        }
    });

    return wss;
}

async function hydrateClientAlerts(client: TrackedClient, headers: Record<string, string | string[] | undefined>): Promise<void> {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
        if (!session?.user.id) return;

        await armClientAlerts(client, session.user.id);
    } catch {
        // Alerts remain unavailable for unauthenticated connections.
        // Cross-origin clients will authenticate via the AUTH message instead.
    }
}

async function authenticateWithToken(client: TrackedClient, token: string): Promise<void> {
    try {
        const session = await auth.api.getSession({
            headers: new Headers({ authorization: `Bearer ${token}` }),
        });
        if (!session?.user.id) return;

        await armClientAlerts(client, session.user.id);
    } catch {
        // Invalid token — ignore
    }
}

async function armClientAlerts(client: TrackedClient, userId: string): Promise<void> {
    client.userId = userId;
    const alerts = await listActiveAlertsByUser(userId);
    setConnectionAlerts(
        client.id,
        alerts.map((alert) => ({
            id: alert.id,
            symbol: alert.symbol,
            above: alert.above ?? undefined,
            below: alert.below ?? undefined,
        })),
    );
}

async function handleMessage(client: TrackedClient, raw: string): Promise<void> {
    let msg: WsIncomingMessage;
    try {
        msg = JSON.parse(raw);
    } catch {
        send(client.ws, {
            type: "ERROR",
            code: "INVALID_JSON",
            message: "Message must be valid JSON",
        });
        return;
    }

    if (!msg.type) {
        send(client.ws, {
            type: "ERROR",
            code: "MISSING_TYPE",
            message: "Message must include a type field",
        });
        return;
    }

    switch (msg.type) {
        case "AUTH": {
            if (!msg.token || typeof msg.token !== "string") {
                send(client.ws, { type: "ERROR", code: "MISSING_TOKEN", message: "AUTH requires a token" });
                return;
            }
            await authenticateWithToken(client, msg.token);
            break;
        }

        case "SUBSCRIBE": {
            const symbols = msg.symbols ?? [];
            for (const sym of symbols) {
                const upper = sym.toUpperCase();
                if (!isValidSymbol(upper)) {
                    send(client.ws, {
                        type: "ERROR",
                        code: "INVALID_SYMBOL",
                        message: `Unknown symbol: ${sym}`,
                    });
                    continue;
                }
                client.subscriptions.add(upper);
                const snapshot = simulator.getBuffer(upper).slice(-60);
                send(client.ws, { type: "SNAPSHOT", symbol: upper, ticks: snapshot });
            }
            break;
        }

        case "UNSUBSCRIBE": {
            for (const sym of msg.symbols ?? []) {
                client.subscriptions.delete(sym.toUpperCase());
            }
            send(client.ws, { type: "SUBSCRIBED", message: "Unsubscribed successfully" });
            break;
        }

        case "SET_ALERT": {
            if (!msg.symbol || !isValidSymbol(msg.symbol)) {
                send(client.ws, {
                    type: "ERROR",
                    code: "INVALID_SYMBOL",
                    message: "Invalid or missing symbol for alert",
                });
                return;
            }

            if (!client.userId) {
                send(client.ws, {
                    type: "ERROR",
                    code: "NO_SESSION",
                    message: "You must be signed in to create alerts",
                });
                return;
            }

            if (msg.above === undefined && msg.below === undefined) {
                send(client.ws, {
                    type: "ERROR",
                    code: "MISSING_THRESHOLD",
                    message: "Provide 'above' and/or 'below' threshold",
                });
                return;
            }

            if (msg.above !== undefined && msg.below !== undefined && msg.above <= msg.below) {
                send(client.ws, {
                    type: "ERROR",
                    code: "INVALID_THRESHOLD_RANGE",
                    message: "'above' must be greater than 'below' when both are provided",
                });
                return;
            }

            let alertId = msg.alertId;
            if (!alertId) {
                const created = await createAlert({
                    userId: client.userId,
                    symbol: msg.symbol.toUpperCase(),
                    above: msg.above,
                    below: msg.below,
                });
                alertId = created.id;
            } else {
                const existing = await findActiveAlertById(client.userId, alertId);
                if (!existing) {
                    send(client.ws, {
                        type: "ERROR",
                        code: "ALERT_NOT_FOUND",
                        message: "Alert could not be armed",
                    });
                    return;
                }
            }

            addAlert({
                id: alertId,
                symbol: msg.symbol.toUpperCase(),
                above: msg.above,
                below: msg.below,
                connectionId: client.id,
            });
            send(client.ws, {
                type: "SUBSCRIBED",
                message: `Alert set for ${msg.symbol.toUpperCase()}`,
            });
            break;
        }

        case "REMOVE_ALERT": {
            if (!msg.alertId) {
                send(client.ws, {
                    type: "ERROR",
                    code: "MISSING_ALERT_ID",
                    message: "Provide alertId to remove an alert",
                });
                return;
            }

            removeConnectionAlert(client.id, msg.alertId);

            if (client.userId) {
                await deleteAlert(msg.alertId, client.userId);
            }

            send(client.ws, {
                type: "SUBSCRIBED",
                message: "Alert removed",
            });
            break;
        }

        default:
            send(client.ws, {
                type: "ERROR",
                code: "UNKNOWN_TYPE",
                message: `Unknown message type: ${msg.type}`,
            });
    }
}

function send(ws: WebSocket, msg: WsOutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
