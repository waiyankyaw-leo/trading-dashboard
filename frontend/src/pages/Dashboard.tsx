import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { ChartContainer } from "../components/chart/ChartContainer";
import { AlertBanner } from "../components/alerts/AlertBanner";
import { Spinner } from "../components/ui/Spinner";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTickers } from "../hooks/useTickerData";
import { useTickerStore } from "../store/tickerStore";

const ALL_SYMBOLS = ["AAPL", "TSLA", "BTC-USD", "ETH-USD", "GOOGL", "MSFT"];

export function Dashboard() {
    const { data: tickers, isLoading, error } = useTickers();
    const setTickers = useTickerStore((s) => s.setTickers);

    // Horizontal (sidebar) resize
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const isDraggingH = useRef(false);

    const { setAlert, removeAlert } = useWebSocket(ALL_SYMBOLS);

    useEffect(() => {
        if (tickers) setTickers(tickers);
    }, [tickers, setTickers]);

    const handleHDown = useCallback(() => {
        isDraggingH.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDraggingH.current) {
            const newWidth = window.innerWidth - e.clientX;
            setSidebarWidth(Math.min(Math.max(newWidth, 220), Math.floor(window.innerWidth * 0.5)));
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isDraggingH.current) {
            isDraggingH.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                </div>
            </div>
        );
    }

    if (error || !tickers) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-red-400 text-center">
                        <p className="text-lg font-medium">Failed to load market data</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Check that the backend is running on port 4000
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
            <Header />
            <AlertBanner />
            {/* Chart row — fills all remaining height */}
            <div className="flex flex-row flex-1 overflow-hidden min-h-0">
                <ChartContainer onSetAlert={setAlert} onRemoveAlert={removeAlert} />
                {/* Horizontal resize handle */}
                <div
                    className="hidden lg:block w-[3px] shrink-0 bg-gray-800 hover:bg-blue-500 active:bg-blue-500 cursor-col-resize transition-colors"
                    onMouseDown={handleHDown}
                />
                <div className="shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
                    <Sidebar tickers={tickers} />
                </div>
            </div>
        </div>
    );
}
