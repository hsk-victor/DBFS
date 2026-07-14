import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/shared/lib/api";
/** Central dashboard state: canvas layout, quotes, FX, holdings, orders. */
export function useDashboard(authed) {
    const [layout, setLayout] = useState(null);
    const [symbols, setSymbols] = useState([]);
    const [quotes, setQuotes] = useState({});
    const [fx, setFx] = useState({ rate: 1.2748, date: "", provider: "…", source: "demo" });
    const [holdings, setHoldings] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const saveTimer = useRef(null);
    const refreshHoldings = useCallback(async () => {
        try {
            const r = await api.get("/api/portfolio/holdings");
            setHoldings(r.holdings);
        }
        catch { /* keep last state */ }
    }, []);
    const refreshOrders = useCallback(async () => {
        try {
            setOrders(await api.get("/api/orders"));
        }
        catch { /* keep last state */ }
    }, []);
    const refreshQuotes = useCallback(async (syms) => {
        const results = await Promise.allSettled(syms.map((s) => api.get(`/api/market/quote/${s}`)));
        setQuotes((prev) => {
            const next = { ...prev };
            results.forEach((r, i) => {
                if (r.status === "fulfilled")
                    next[syms[i]] = r.value;
            });
            return next;
        });
    }, []);
    const refreshMarket = useCallback(async () => {
        if (refreshing)
            return;
        // Lightweight price/change summaries are allowed for every supported
        // ticker. Rich stock data is loaded only by mounted StockCard tabs.
        const requested = symbols.map((row) => row.symbol);
        setRefreshing(true);
        setRefreshError(false);
        try {
            const result = await api.post("/api/market/refresh", {
                symbols: requested,
            });
            setFx(result.fx);
            setQuotes((previous) => {
                const next = { ...previous };
                for (const quote of result.quotes)
                    next[quote.symbol] = quote;
                return next;
            });
            setSymbols((previous) => previous.map((row) => {
                const quote = result.quotes.find((item) => item.symbol === row.symbol);
                return quote ? {
                    ...row,
                    price: quote.price,
                    change_pct: quote.change_pct,
                    source: quote.source,
                } : row;
            }));
            await Promise.all([refreshHoldings(), refreshOrders()]);
            setLastUpdatedAt(Date.now());
        }
        catch {
            setRefreshError(true);
        }
        finally {
            setRefreshing(false);
        }
    }, [refreshHoldings, refreshOrders, refreshing, symbols]);
    // Initial load once authenticated
    useEffect(() => {
        if (!authed)
            return;
        let alive = true;
        (async () => {
            setLoading(true);
            const [layoutRes, symbolsRes, fxRes] = await Promise.allSettled([
                api.get("/api/portfolio/watchlist"),
                api.get("/api/market/symbols"),
                api.get("/api/market/fx"),
            ]);
            if (!alive)
                return;
            if (layoutRes.status === "fulfilled")
                setLayout(layoutRes.value.layout);
            else
                setLayout([]);
            if (symbolsRes.status === "fulfilled") {
                setSymbols(symbolsRes.value);
                setQuotes((prev) => {
                    const next = { ...prev };
                    for (const row of symbolsRes.value) {
                        next[row.symbol] = {
                            symbol: row.symbol, price: row.price, change_pct: row.change_pct,
                            prev_close: 0, high: 0, low: 0, open: 0, source: row.source,
                        };
                    }
                    return next;
                });
            }
            if (fxRes.status === "fulfilled")
                setFx(fxRes.value);
            await Promise.all([refreshHoldings(), refreshOrders()]);
            if (alive) {
                setLastUpdatedAt(Date.now());
                setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [authed, refreshHoldings, refreshOrders]);
    // Persist layout to Supabase (debounced)
    const persist = useCallback((next) => {
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            api.put("/api/portfolio/watchlist", next).catch(() => { });
        }, 800);
    }, []);
    const updateLayout = useCallback((fn) => {
        setLayout((prev) => {
            if (!prev)
                return prev;
            const next = fn(prev);
            persist(next);
            return next;
        });
    }, [persist]);
    const patchCard = useCallback((sym, patch) => {
        updateLayout((prev) => prev.map((c) => (c.sym === sym ? { ...c, ...patch } : c)));
    }, [updateLayout]);
    const maxZ = layout ? Math.max(10, ...layout.map((c) => c.z)) : 10;
    const bringFront = useCallback((sym) => {
        updateLayout((prev) => {
            const top = Math.max(10, ...prev.map((c) => c.z)) + 1;
            return prev.map((c) => (c.sym === sym ? { ...c, z: top } : c));
        });
    }, [updateLayout]);
    const removeCard = useCallback((sym) => {
        updateLayout((prev) => prev.filter((c) => c.sym !== sym));
    }, [updateLayout]);
    const addCard = useCallback((sym, panX, panY, zoom) => {
        updateLayout((prev) => {
            const top = Math.max(10, ...prev.map((c) => c.z)) + 1;
            const n = prev.length;
            const bx = (60 - panX) / zoom;
            const by = (60 - panY) / zoom;
            const isPf = sym === "__PF";
            return [...prev, {
                    sym,
                    x: Math.round(bx + (n % 4) * 40),
                    y: Math.round(by + (n % 4) * 40),
                    w: isPf ? 400 : 344, h: isPf ? 356 : 400,
                    z: top, tab: "ai", big: false,
                }];
        });
    }, [updateLayout]);
    const resetLayout = useCallback(async () => {
        // Server returns the default layout when nothing is stored
        await api.put("/api/portfolio/watchlist", []).catch(() => { });
        const r = await api.get("/api/portfolio/watchlist").catch(() => null);
        const fallback = [
            { sym: "NVDA", x: 36, y: 36, w: 344, h: 400, z: 1, tab: "ai", big: false },
            { sym: "GOOG", x: 412, y: 92, w: 344, h: 400, z: 2, tab: "ai", big: false },
            { sym: "INTC", x: 788, y: 36, w: 344, h: 400, z: 3, tab: "ai", big: false },
            { sym: "__PF", x: 36, y: 470, w: 400, h: 356, z: 5, tab: "ai", big: false },
        ];
        const next = r && r.layout.length ? r.layout : fallback;
        setLayout(next);
        persist(next);
    }, [persist]);
    // Report the source state for stock cards currently on the canvas.
    // Summary quotes for dormant add-card choices do not make a fresh canvas stale.
    const relevantSymbols = new Set();
    for (const card of layout ?? []) {
        if (card.sym !== "__PF")
            relevantSymbols.add(card.sym);
    }
    const sources = [...relevantSymbols]
        .map((symbol) => quotes[symbol]?.source)
        .filter(Boolean);
    sources.push(fx.source);
    const dataState = sources.includes("demo")
        ? "demo"
        : sources.includes("cached") ? "cached" : "live";
    return {
        layout, symbols, quotes, fx, holdings, orders, loading, refreshing, refreshError, lastUpdatedAt,
        dataState, maxZ,
        patchCard, bringFront, removeCard, addCard, resetLayout, updateLayout,
        refreshHoldings, refreshOrders, refreshQuotes, refreshMarket,
    };
}
