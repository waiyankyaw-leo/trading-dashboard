import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTickerStore } from "@/store/tickerStore";

const AUTO_DISMISS_MS = 6000;

function AlertToast({ message, index, onDismiss }: { message: string; index: number; onDismiss: (i: number) => void }) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => onDismiss(index), AUTO_DISMISS_MS);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [index, onDismiss]);

    // Split message into the crossing part and the "current: X" part for better layout
    const match = message.match(/^(.+?) — (current: .+)$/);
    const primary = match ? match[1] : message;
    const secondary = match ? match[2] : null;

    return (
        <div className="relative flex items-start gap-3 w-80 rounded-xl border border-amber-500/30 bg-gray-900/95 px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md ring-1 ring-inset ring-white/5 animate-in slide-in-from-right-4 fade-in duration-200">
            {/* Coloured left accent bar */}
            <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-amber-400" />

            {/* Icon */}
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                <AlertTriangle size={15} className="text-amber-400" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-5">
                <p className="text-[13px] font-semibold leading-snug text-amber-100 break-words">
                    {primary}
                </p>
                {secondary && (
                    <p className="mt-0.5 text-[11px] font-mono text-amber-400/80">
                        {secondary}
                    </p>
                )}
            </div>

            {/* Dismiss */}
            <button
                onClick={() => onDismiss(index)}
                className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                aria-label="Dismiss alert"
            >
                <X size={12} />
            </button>

            {/* Auto-dismiss progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl overflow-hidden">
                <div
                    className="h-full bg-amber-400/50"
                    style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
                />
            </div>
        </div>
    );
}

export function AlertBanner() {
    const alerts = useTickerStore((s) => s.alerts);
    const dismissAlert = useTickerStore((s) => s.dismissAlert);

    if (alerts.length === 0) return null;

    return (
        <>
            <style>{`
                @keyframes shrink { from { width: 100%; } to { width: 0%; } }
                .animate-in { animation-fill-mode: both; }
                .slide-in-from-right-4 { --tw-enter-translate-x: 1rem; }
                .fade-in { --tw-enter-opacity: 0; }
                @keyframes slide-in-from-right-4-fade {
                    from { opacity: 0; transform: translateX(1rem); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .animate-in.slide-in-from-right-4.fade-in { animation: slide-in-from-right-4-fade 0.2s ease both; }
            `}</style>
            <div className="fixed bottom-6 right-5 z-50 flex flex-col-reverse gap-2.5 items-end">
                {alerts.map((alert, index) => (
                    <AlertToast
                        key={`${alert}-${index}`}
                        message={alert}
                        index={index}
                        onDismiss={dismissAlert}
                    />
                ))}
            </div>
        </>
    );
}
