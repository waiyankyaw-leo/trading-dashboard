import type { Tick } from "../types/index.js";

export interface AlertRule {
    id: string;
    symbol: string;
    above?: number;
    below?: number;
    connectionId: string;
}

interface FiredAlert {
    connectionId: string;
    alertId: string;
    message: string;
}

const rules = new Map<string, AlertRule[]>();

export function addAlert(rule: AlertRule): void {
    const existing = rules.get(rule.connectionId) ?? [];
    const existingIndex = existing.findIndex((entry) => entry.id === rule.id);
    if (existingIndex !== -1) {
        existing[existingIndex] = rule;
        rules.set(rule.connectionId, existing);
        return;
    }
    existing.push(rule);
    rules.set(rule.connectionId, existing);
}

export function setConnectionAlerts(connectionId: string, alerts: Omit<AlertRule, "connectionId">[]): void {
    if (alerts.length === 0) {
        rules.delete(connectionId);
        return;
    }

    rules.set(
        connectionId,
        alerts.map((alert) => ({
            ...alert,
            connectionId,
        })),
    );
}

export function removeConnectionAlert(connectionId: string, alertId: string): void {
    const existing = rules.get(connectionId);
    if (!existing) return;

    const next = existing.filter((rule) => rule.id !== alertId);
    if (next.length === 0) {
        rules.delete(connectionId);
        return;
    }

    rules.set(connectionId, next);
}

export function removeConnectionAlerts(connectionId: string): void {
    rules.delete(connectionId);
}

export function checkAlerts(tick: Tick): FiredAlert[] {
    const fired: FiredAlert[] = [];
    const firedIds = new Set<string>();

    for (const [connectionId, connectionRules] of rules.entries()) {
        for (let i = connectionRules.length - 1; i >= 0; i--) {
            const rule = connectionRules[i];
            if (rule.symbol !== tick.symbol) continue;

            const crossedAbove = rule.above !== undefined && tick.price >= rule.above;
            const crossedBelow = rule.below !== undefined && tick.price <= rule.below;
            if (!crossedAbove && !crossedBelow) continue;

            // Remove the rule from this connection so it only triggers once per connection
            connectionRules.splice(i, 1);

            // Dedupe across connections: same alertId in multiple tabs fires only once per tick
            if (firedIds.has(rule.id)) continue;
            firedIds.add(rule.id);

            const threshold = crossedAbove ? rule.above : rule.below;
            const direction = crossedAbove ? "above" : "below";
            const fmt = (n: number) => n.toFixed(2);
            fired.push({
                connectionId,
                alertId: rule.id,
                message: `${tick.symbol} crossed ${direction} ${fmt(threshold!)} — current: ${fmt(tick.price)}`,
            });
        }

        if (connectionRules.length === 0) {
            rules.delete(connectionId);
        }
    }

    return fired;
}

export function getAlertCount(): number {
    let count = 0;
    for (const r of rules.values()) count += r.length;
    return count;
}
