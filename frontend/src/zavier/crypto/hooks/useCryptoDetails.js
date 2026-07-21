import { useEffect, useMemo, useRef, useState } from "react";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";
import { mapCandles, mapSpark } from "@/zavier/crypto/lib/cryptoFormat";

export function useCryptoDetails(symbol, coin, activeTab) {
    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(false);
    const [newsLoading, setNewsLoading] = useState(false);
    const [loadedSymbol, setLoadedSymbol] = useState(null);
    const [eod, setEod] = useState(null);
    const [fund, setFund] = useState(null);
    const [chart, setChart] = useState(null);
    const [news, setNews] = useState(null);
    const [newsError, setNewsError] = useState("");
    const [error, setError] = useState("");
    const inFlightSymbol = useRef(null);
    const currentTab = activeTab ?? tab;

    useEffect(() => {
        if (!symbol)
            return;
        if (loadedSymbol === symbol || inFlightSymbol.current === symbol)
            return;
        inFlightSymbol.current = symbol;
        let alive = true;

        (async () => {
            setLoading(true);
            setError("");
            setNews(null);
            setNewsError("");
            try {
                // Keep the initial mount light: prices are handled elsewhere,
                // and chart/data/news are loaded on-demand by tab.
                if (!alive)
                    return;
                setLoadedSymbol(symbol);
            }
            catch (e) {
                if (alive)
                    setError(e instanceof Error ? e.message : "Failed to load crypto details");
            }
            finally {
                if (alive)
                    setLoading(false);
                if (inFlightSymbol.current === symbol)
                    inFlightSymbol.current = null;
            }
        })();

        return () => {
            alive = false;
        };
    }, [symbol, loadedSymbol]);

    useEffect(() => {
        if (!symbol || chart !== null)
            return;
        let alive = true;
        setLoading(true);
        console.info("[crypto/details] request start", { symbol, endpoint: "/api/crypto/chart", force: false });
        cryptoApi.chart()
            .then((res) => {
                if (!alive)
                    return;
                const next = (res.items ?? []).find((item) => item.symbol === symbol) ?? null;
                setChart(next);
                console.info("[crypto/details] chart settled", { symbol, status: "fulfilled", chartPoints: next?.points?.length ?? 0 });
            })
            .catch((e) => {
                if (!alive)
                    return;
                setChart(null);
                console.info("[crypto/details] chart settled", { symbol, status: "rejected", chartError: e instanceof Error ? e.message : String(e) });
            })
            .finally(() => {
                if (alive)
                    setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [symbol, chart]);

    useEffect(() => {
        if (!symbol || currentTab !== "overview" || fund !== null)
            return;
        let alive = true;
        setLoading(true);
        console.info("[crypto/details] request start", { symbol, endpoint: "/api/crypto/fundamentals", force: false });
        cryptoApi.fundamentals()
            .then((res) => {
                if (!alive)
                    return;
                const next = (res.items ?? []).find((item) => item.symbol === symbol) ?? null;
                setFund(next);
                console.info("[crypto/details] fundamentals settled", { symbol, status: "fulfilled", hasFund: Boolean(next) });
            })
            .catch((e) => {
                if (!alive)
                    return;
                setFund(null);
                console.info("[crypto/details] fundamentals settled", { symbol, status: "rejected", fundamentalsError: e instanceof Error ? e.message : String(e) });
            })
            .finally(() => {
                if (alive)
                    setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [symbol, currentTab, fund]);

    useEffect(() => {
        if (!symbol || currentTab !== "overview" || eod !== null)
            return;
        let alive = true;
        setLoading(true);
        console.info("[crypto/details] request start", { symbol, endpoint: "/api/crypto/eod", force: false });
        cryptoApi.eod()
            .then((res) => {
                if (!alive)
                    return;
                const next = (res.items ?? []).find((item) => item.symbol === symbol) ?? null;
                setEod(next);
                console.info("[crypto/details] eod settled", { symbol, status: "fulfilled", eodPoints: next?.points?.length ?? 0 });
            })
            .catch((e) => {
                if (!alive)
                    return;
                setEod(null);
                console.info("[crypto/details] eod settled", { symbol, status: "rejected", eodError: e instanceof Error ? e.message : String(e) });
            })
            .finally(() => {
                if (alive)
                    setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [symbol, currentTab, eod]);

    useEffect(() => {
        if (!symbol || currentTab !== "news" || news !== null)
            return;
        let alive = true;
        setNewsLoading(true);
        setNewsError("");
        console.info("[crypto/details] request start", { symbol, endpoint: "/api/crypto/news", force: false });
        cryptoApi.news(symbol)
            .then((res) => {
                if (!alive)
                    return;
                const items = res.items ?? [];
                setNews(items);
                console.info("[crypto/details] news settled", { symbol, status: "fulfilled", newsItems: items.length });
            })
            .catch((e) => {
                if (!alive)
                    return;
                setNews([]);
                const message = e instanceof Error ? e.message : String(e);
                setNewsError(message);
                console.info("[crypto/details] news settled", { symbol, status: "rejected", newsError: message });
            })
            .finally(() => {
                if (alive)
                    setNewsLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [symbol, currentTab, news]);

    const chartCandles = useMemo(() => mapCandles(chart?.points), [chart]);
    const eodCandles = useMemo(() => mapCandles(eod?.points), [eod]);
    const candles = chartCandles.length ? chartCandles : eodCandles;
    const spark = useMemo(() => mapSpark(chart?.points), [chart]);

    const metrics = useMemo(() => {
        if (!fund)
            return [];
        return [
            ["Name", fund.name ?? coin?.name ?? symbol],
            ["Type", fund.type ?? "—"],
            ["Currency", fund.currency ?? "—"],
            ["Market cap", fund.market_cap ? `$${Number(fund.market_cap).toLocaleString()}` : "—"],
            ["Symbol", fund.symbol ?? symbol],
        ];
    }, [fund, coin?.name, symbol]);

    return {
        tab,
        setTab,
        loading,
        newsLoading,
        loadedSymbol,
        eod,
        fund,
        news,
        newsError,
        chart,
        candles,
        spark,
        metrics,
        error,
    };
}
