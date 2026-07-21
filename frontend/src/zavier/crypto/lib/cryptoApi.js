import { api } from "@/shared/lib/api";

export const cryptoApi = {
    prices: () => api.get("/api/crypto/prices?force=true"),
    eod: () => api.get("/api/crypto/eod"),
    fundamentals: () => api.get("/api/crypto/fundamentals"),
    chart: () => api.get("/api/crypto/chart"),
    news: (symbol) => api.get(`/api/crypto/news?symbol=${symbol}`),
    fx: () => api.get("/api/crypto/fx"),
    order: (body) => api.post("/api/crypto/orders", body),
    orderStatus: (orderId) => api.get(`/api/crypto/orders/${orderId}`),
};
