import { Bell, X } from "lucide-react";

interface DeleteConfirmModalProps {
    confirmDelete: { alertId: string; label: string } | null;
    isDeletingAlert: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function DeleteConfirmModal({ confirmDelete, isDeletingAlert, onConfirm, onCancel }: DeleteConfirmModalProps) {
    if (!confirmDelete) return null;
    return (
        <div
            data-alert-action="delete-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { if (!isDeletingAlert) onCancel(); }}
        >
            <div
                className="w-[340px] rounded-lg bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Bell size={15} className="text-yellow-500" />
                        Delete alert
                    </h2>
                    <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600 leading-none p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isDeletingAlert}
                        onClick={onCancel}
                    >
                        <X size={15} />
                    </button>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    Do you really want to delete your alert &apos;{confirmDelete.label}&apos;?
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        disabled={isDeletingAlert}
                        className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={onCancel}
                    >
                        No
                    </button>
                    <button
                        type="button"
                        disabled={isDeletingAlert}
                        className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:cursor-not-allowed disabled:bg-red-400"
                        onClick={onConfirm}
                    >
                        {isDeletingAlert ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}
