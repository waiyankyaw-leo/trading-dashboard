import { apiClient } from "./axiosClient";
import type { PriceAlert } from "../types";

export interface CreateAlertPayload {
    symbol: string;
    above?: number;
    below?: number;
}

export interface UpdateAlertPayload {
    above?: number;
    below?: number;
}

export const fetchAlerts = (signal?: AbortSignal) =>
    apiClient.get<PriceAlert[]>("/api/alerts", { signal }).then((response) => response.data);

export const createPriceAlert = (payload: CreateAlertPayload) =>
    apiClient.post<PriceAlert>("/api/alerts", payload).then((response) => response.data);

export const updatePriceAlert = (alertId: string, payload: UpdateAlertPayload) =>
    apiClient.patch<PriceAlert>(`/api/alerts/${alertId}`, payload).then((response) => response.data);

export const deletePriceAlert = (alertId: string) =>
    apiClient.delete(`/api/alerts/${alertId}`).then((response) => response.data);