export function formatWhen(value) {
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return String(value);
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function mapSpark(points) {
    return (points ?? []).map((p) => {
        const ts = Number(p?.ts_ms ?? p?.t ?? 0);
        const t = Number.isFinite(ts) && ts > 1e12 ? Math.floor(ts / 1000) : ts;
        const c = Number(p?.price_sgd ?? p?.close ?? p?.c ?? 0);
        return { t, c: Number.isFinite(c) ? c : 0 };
    });
}

export function mapCandles(points) {
    return (points ?? []).map((p, idx, arr) => {
        const ts = Number(p?.ts_ms ?? p?.t ?? 0);
        const t = Number.isFinite(ts) && ts > 1e12 ? Math.floor(ts / 1000) : (p?.date ?? p?.t ?? p?.ts_ms);
        const c = Number(p?.close ?? p?.c ?? p?.price_sgd ?? 0);
        const prev = arr[idx - 1];
        const prevClose = Number(prev?.close ?? prev?.c ?? prev?.price_sgd ?? c);
        const o = Number(p?.open ?? p?.o ?? prevClose ?? c);
        const h = Number(p?.high ?? p?.h ?? Math.max(o, c));
        const l = Number(p?.low ?? p?.l ?? Math.min(o, c));
        return {
            t,
            o: Number.isFinite(o) ? o : 0,
            h: Number.isFinite(h) ? h : 0,
            l: Number.isFinite(l) ? l : 0,
            c: Number.isFinite(c) ? c : 0,
        };
    });
}
