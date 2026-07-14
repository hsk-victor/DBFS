export const fmtUsd = (n) => "$" + n.toFixed(2);
export const fmtSgd = (n) => "S$" + n.toFixed(2);
export const fmtPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
export const fmtQty = (q) => Math.abs(q - Math.round(q)) < 1e-4 ? String(Math.round(q)) : q.toFixed(4);
export const SENT_BG = {
    Bullish: "#dcfce7",
    Neutral: "#f4f4f5",
    Bearish: "#fee2e2",
};
export const SENT_FG = {
    Bullish: "#166534",
    Neutral: "#52525b",
    Bearish: "#991b1b",
};
export function timeAgo(unixSeconds) {
    const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
    if (diff < 3600)
        return Math.max(1, Math.round(diff / 60)) + "m";
    if (diff < 86400)
        return Math.round(diff / 3600) + "h";
    return Math.round(diff / 86400) + "d";
}
