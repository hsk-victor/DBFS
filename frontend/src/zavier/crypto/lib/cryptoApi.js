import { api } from "@/shared/lib/api";

export const cryptoApi = {
    prices: () => api.get("/api/crypto/prices?force=true"),
    eod: () => api.get("/api/crypto/eod?force=true"),
    fundamentals: () => api.get("/api/crypto/fundamentals?force=true"),
    chart: () => api.get("/api/crypto/chart?force=true"),
    news: (symbol) => api.get(`/api/crypto/news?symbol=${symbol}`),
    fx: () => api.get("/api/market/fx"),
    order: (body) => api.post("/api/crypto/orders", body),
};
