import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
} from "@tanstack/react-query";
import {
    createPriceAlert,
    deletePriceAlert,
    fetchAlerts,
    updatePriceAlert,
    type CreateAlertPayload,
    type UpdateAlertPayload,
} from "../api/alertsApi";
import type { PriceAlert } from "../types";

export const alertsQueryKey = ["alerts"] as const;

interface UpdateAlertArgs {
    alertId: string;
    payload: UpdateAlertPayload;
}

interface AlertsMutationContext {
    previousAlerts?: PriceAlert[];
}

function replaceAlert(alerts: PriceAlert[] | undefined, updated: PriceAlert): PriceAlert[] {
    if (!alerts) return [updated];
    let found = false;
    const next = alerts.map((alert) => {
        if (alert.id !== updated.id) return alert;
        found = true;
        return updated;
    });
    return found ? next : [updated, ...alerts];
}

export function removeAlertsFromCache(queryClient: QueryClient, alertIds: string[]): void {
    if (alertIds.length === 0) return;
    const ids = new Set(alertIds);
    queryClient.setQueryData<PriceAlert[]>(alertsQueryKey, (current) =>
        (current ?? []).filter((alert) => !ids.has(alert.id)),
    );
}

export function useAlerts(symbol?: string) {
    return useQuery({
        queryKey: alertsQueryKey,
        queryFn: ({ signal }) => fetchAlerts(signal),
        staleTime: 10_000,
        select: (alerts) => (symbol ? alerts.filter((alert) => alert.symbol === symbol) : alerts),
    });
}

export function useCreateAlertMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateAlertPayload) => createPriceAlert(payload),
        onSuccess: (created) => {
            queryClient.setQueryData<PriceAlert[]>(alertsQueryKey, (current) => [
                created,
                ...(current ?? []).filter((alert) => alert.id !== created.id),
            ]);
        },
    });
}

export function useUpdateAlertMutation() {
    const queryClient = useQueryClient();

    return useMutation<PriceAlert, Error, UpdateAlertArgs, AlertsMutationContext>({
        mutationFn: ({ alertId, payload }) => updatePriceAlert(alertId, payload),
        onMutate: async ({ alertId, payload }) => {
            await queryClient.cancelQueries({ queryKey: alertsQueryKey });
            const previousAlerts = queryClient.getQueryData<PriceAlert[]>(alertsQueryKey);

            queryClient.setQueryData<PriceAlert[]>(alertsQueryKey, (current) =>
                (current ?? []).map((alert) => {
                    if (alert.id !== alertId) return alert;
                    return {
                        ...alert,
                        above: payload.above ?? null,
                        below: payload.below ?? null,
                    };
                }),
            );

            return { previousAlerts };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousAlerts) {
                queryClient.setQueryData(alertsQueryKey, context.previousAlerts);
            }
        },
        onSuccess: (updated) => {
            queryClient.setQueryData<PriceAlert[]>(alertsQueryKey, (current) => replaceAlert(current, updated));
        },
    });
}

export function useDeleteAlertMutation() {
    const queryClient = useQueryClient();

    return useMutation<string, Error, string, AlertsMutationContext>({
        mutationFn: async (alertId) => {
            await deletePriceAlert(alertId);
            return alertId;
        },
        onMutate: async (alertId) => {
            await queryClient.cancelQueries({ queryKey: alertsQueryKey });
            const previousAlerts = queryClient.getQueryData<PriceAlert[]>(alertsQueryKey);

            removeAlertsFromCache(queryClient, [alertId]);

            return { previousAlerts };
        },
        onError: (_error, _alertId, context) => {
            if (context?.previousAlerts) {
                queryClient.setQueryData(alertsQueryKey, context.previousAlerts);
            }
        },
    });
}