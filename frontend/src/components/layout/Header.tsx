import { useSession, signOut } from "@/lib/authClient";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useTickerStore } from "@/store/tickerStore";

export function Header() {
    const { data: session } = useSession();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const notifications = useTickerStore((s) => s.notifications);
    const markAllNotificationsRead = useTickerStore((s) => s.markAllNotificationsRead);
    const clearNotifications = useTickerStore((s) => s.clearNotifications);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Close panel when clicking outside
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    const handleOpen = () => {
        setOpen((prev) => !prev);
        if (!open && unreadCount > 0) markAllNotificationsRead();
    };

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xl font-bold">◈</span>
                <span className="text-white font-semibold text-lg">TradeDash</span>
                <span className="hidden sm:inline text-gray-500 text-xs ml-2 mt-0.5">
                    Real-Time Trading
                </span>
            </div>
            {session && (
                <div className="flex items-center gap-3">
                    {/* Notification bell */}
                    <div ref={panelRef} className="relative">
                        <button
                            onClick={handleOpen}
                            className="relative p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            title="Alert notifications"
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown panel */}
                        {open && (
                            <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                                        <Bell size={14} className="text-yellow-400" />
                                        Alert Notifications
                                    </span>
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={clearNotifications}
                                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                                            No notifications yet
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div
                                                key={n.id}
                                                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 last:border-0 ${n.read ? "opacity-60" : ""}`}
                                            >
                                                <Bell size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-200 leading-snug">{n.message}</p>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        {new Date(n.ts).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                {!n.read && (
                                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <span className="text-gray-400 text-sm hidden sm:inline">{session.user.email}</span>
                    <button
                        onClick={handleSignOut}
                        className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-md transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </header>
    );
}
