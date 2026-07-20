import { useCallback, useEffect, useMemo, useState } from "react";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";

export function useCryptoDashboard() {
    const [fx, setFx] = useState({ rate: 1.2748, source: "demo" });
    const [quotes, setQuotes] = useState([]);
    const [eod, setEod] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const eodLookup = useMemo(() => Object.fromEntries(eod.map((row) => [row.symbol, row])), [eod]);
    const priceLookup = useMemo(() => Object.fromEntries(quotes.map((row) => [row.symbol, row])), [quotes]);

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
        eodLookup,
        priceLookup,
        loading,
        refreshing,
        error,
        refresh,
    };
}
