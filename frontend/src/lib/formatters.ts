export function formatPrice(value: number, isCrypto: boolean): string {
    return isCrypto
        ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : value.toFixed(2);
}

export function formatTimestamp(tSec: number): string {
    const d = new Date(tSec * 1000);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
