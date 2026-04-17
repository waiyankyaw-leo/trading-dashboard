import { Bell, RotateCcw } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

interface ChartContextMenuProps {
    contextMenu: { x: number; y: number; price: number } | null;
    onAddAlert: (price: number) => void;
    onResetView: () => void;
    isViewMoved: boolean;
    isCrypto: boolean;
}

export function ChartContextMenu({ contextMenu, onAddAlert, onResetView, isViewMoved, isCrypto }: ChartContextMenuProps) {
    if (!contextMenu) return null;
    return (
        <div
            className="fixed z-50 bg-[#1e293b] border border-gray-700 rounded shadow-2xl py-1 min-w-[220px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
        >
            {contextMenu.price > 0 && (
                <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700/60 text-gray-200 text-sm transition-colors"
                    onClick={() => onAddAlert(contextMenu.price)}
                >
                    <span className="flex items-center gap-2.5">
                        <Bell size={14} className="shrink-0" />
                        <span>Add Alert at ${formatPrice(contextMenu.price, isCrypto)}</span>
                    </span>
                </button>
            )}
            {isViewMoved && (
                <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700/60 text-gray-200 text-sm transition-colors"
                    onClick={onResetView}
                >
                    <span className="flex items-center gap-2.5">
                        <RotateCcw size={14} className="shrink-0" />
                        <span>Reset chart view</span>
                    </span>
                    <span className="text-gray-500 text-xs ml-8">Alt + R</span>
                </button>
            )}
        </div>
    );
}
