import { useEffect, useMemo, useRef, useState } from "react";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";
import { mapCandles, mapSpark } from "@/zavier/crypto/lib/cryptoFormat";

export function useCryptoDetails(symbol, coin, activeTab) {
    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(false);
    const [newsLoading, setNewsLoading] = useState(false);
    const [loadedSymbol, setLoadedSymbol] = useState(null);
    const inFlightSymbol = useRef(null);
    const [eod, setEod] = useState(null);
    const [fund, setFund] = useState(null);
    const [news, setNews] = useState(null);
    const [newsError, setNewsError] = useState("");
    const [chart, setChart] = useState(null);
    const [error, setError] = useState("");
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
                console.info("[crypto/details] fetching", { symbol });
                const [eodRes, fundRes, chartRes] = await Promise.allSettled([
                    cryptoApi.eod(),
                    cryptoApi.fundamentals(),
                    cryptoApi.chart(),
                ]);
                if (!alive)
                    return;

                console.info("[crypto/details] settled", {
                    symbol,
                    eod: eodRes.status,
                    fundamentals: fundRes.status,
                    chart: chartRes.status,
                    news: "lazy",
                });

                setEod(eodRes.status === "fulfilled" ? (eodRes.value.items ?? []).find((item) => item.symbol === symbol) ?? null : null);
                setFund(fundRes.status === "fulfilled" ? (fundRes.value.items ?? []).find((item) => item.symbol === symbol) ?? null : null);
                setChart(chartRes.status === "fulfilled" ? (chartRes.value.items ?? []).find((item) => item.symbol === symbol) ?? null : null);
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
