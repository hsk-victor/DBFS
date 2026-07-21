import { useCallback, useEffect, useMemo, useState } from "react";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";

export function useCryptoDashboard() {
    const [fx, setFx] = useState({ rate: 1.2748, source: "demo" });
    const [quotes, setQuotes] = useState([]);
    const [eod, setEod] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const eodLookup = useMemo(() => Object.fromEntries(eod.map((row) => [row.symbol, row])), [eod]);
    const priceLookup = useMemo(() => Object.fromEntries(quotes.map((row) => [row.symbol, row])), [quotes]);
    const holdingsView = useMemo(() => holdings.map((row) => {
        const qty = Number(row?.qty ?? 0);
        const avgPrice = Number(row?.avg_price ?? 0);
        const quote = priceLookup[row?.symbol] ?? null;
        const price = Number(quote?.price ?? 0);
        const valueUsd = qty * price;
        const costUsd = qty * avgPrice;
        const plPct = costUsd > 0 ? ((valueUsd - costUsd) / costUsd) * 100 : 0;
        const changePct = Number(quote?.change_pct ?? 0);
        return {
            symbol: row?.symbol,
            qty,
            avg_price: avgPrice,
            price_usd: price,
            value_usd: valueUsd,
            pl_pct: plPct,
            change_pct: changePct,
        };
    }), [holdings, priceLookup]);

    const normalizeQuote = useCallback((row) => ({
        ...row,
        price: Number(row?.price ?? 0),
        change_pct: Number(row?.change_pct ?? 0),
        high: Number(row?.high ?? 0),
        low: Number(row?.low ?? 0),
        open: Number(row?.open ?? 0),
        source: row?.source ?? "demo",
    }), []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        setError("");
        try {
            const [pricesRes, eodRes, fxRes] = await Promise.all([
                cryptoApi.prices(),
                cryptoApi.eod(),
                cryptoApi.fx(),
            ]);

            setQuotes((pricesRes.items ?? []).map(normalizeQuote));
            setEod(eodRes.items ?? []);
            setFx({
                rate: Number(fxRes?.rate ?? 1.2748),
                source: fxRes?.source ?? "live",
            });
            const holdingsRes = await cryptoApi.holdings().catch(() => ({ holdings: [] }));
            setHoldings(Array.isArray(holdingsRes?.holdings) ? holdingsRes.holdings : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load crypto data");
        }
        finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [normalizeQuote]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        fx,
        quotes,
        eod,
        holdings: holdingsView,
        eodLookup,
        priceLookup,
        loading,
        refreshing,
        error,
        refresh,
    };
}
