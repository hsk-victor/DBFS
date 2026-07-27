import { api } from "@/shared/lib/api";

function buildSymbolsQuery(symbols) {
    const list = Array.isArray(symbols)
        ? symbols.map((sym) => String(sym || "").toUpperCase().trim()).filter(Boolean)
        : [];
    if (!list.length)
        return "";
    return `symbols=${encodeURIComponent(list.join(","))}`;
}

export const cryptoApi = {
    prices: (symbols) => {
        const qs = buildSymbolsQuery(symbols);
        return api.get(`/api/crypto/prices?force=true${qs ? `&${qs}` : ""}`);
    },
    eod: (symbols) => {
        const qs = buildSymbolsQuery(symbols);
        return api.get(`/api/crypto/eod${qs ? `?${qs}` : ""}`);
    },
    fundamentals: (symbols) => {
        const qs = buildSymbolsQuery(symbols);
        return api.get(`/api/crypto/fundamentals${qs ? `?${qs}` : ""}`);
    },
    news: (symbol) => api.get(`/api/crypto/news?symbol=${symbol}`),
    fx: () => api.get("/api/crypto/fx"),
    holdings: () => api.get("/api/crypto/holdings"),
    order: (body) => api.post("/api/crypto/orders", body),
    orderStatus: (orderId) => api.get(`/api/crypto/orders/${orderId}`),
};
