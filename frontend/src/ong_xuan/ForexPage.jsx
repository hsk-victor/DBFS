import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";

const currencyNotes = {
    USD: "Useful for US shopping, travel and overseas payments.",
    EUR: "Suitable for Europe travel and euro-denominated spending.",
    GBP: "Useful for UK travel, education fees and online payments.",
};

function money(value) {
    const n = Number(value ?? 0);
    return `S$${n.toLocaleString("en-SG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function num(value, digits = 4) {
    const n = Number(value ?? 0);
    return n.toLocaleString("en-SG", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function StatusBanner({ status, orderId, onDismiss }) {
    if (!status) return null;

    const config = {
        filled: [
            "Purchase completed",
            "Your PayPal Sandbox payment was captured successfully.",
            "bg-green-50 border-green-200 text-green-800",
            "✓",
        ],
        cancelled: [
            "Checkout cancelled",
            "No forex purchase was made.",
            "bg-zinc-50 border-zinc-200 text-zinc-700",
            "–",
        ],
        error: [
            "Payment failed",
            "The PayPal checkout could not be completed.",
            "bg-red-50 border-red-200 text-red-800",
            "×",
        ],
    }[status] ?? [
        "Purchase update",
        "Your order status has been updated.",
        "bg-zinc-50 border-zinc-200 text-zinc-700",
        "i",
    ];

    return (
        <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 ${config[2]}`}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white font-semibold">
                {config[3]}
            </div>

            <div className="flex-1">
                <div className="text-sm font-semibold">{config[0]}</div>
                <div className="mt-0.5 text-xs opacity-80">{config[1]}</div>

                {orderId ? (
                    <div className="mt-1 font-mono text-[11px] opacity-70">
                        Order {orderId}
                    </div>
                ) : null}
            </div>

            <button className="text-xs opacity-70 hover:opacity-100" onClick={onDismiss}>
                Dismiss
            </button>
        </div>
    );
}

function MiniTrendChart({ history, currency }) {
    const points = history?.history ?? [];

    if (!points.length) {
        return (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center text-xs text-zinc-500">
                No 7-day trend data available.
            </div>
        );
    }

    const values = points.map((p) => Number(p[currency] || 0)).filter(Boolean);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const polyline = points
        .map((p, index) => {
            const x = (index / Math.max(points.length - 1, 1)) * 100;
            const y = 40 - ((Number(p[currency]) - min) / range) * 35;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-zinc-950">
                        7-Day {currency}/SGD Trend
                    </div>
                    <div className="text-xs text-zinc-500">
                        Source: {history.source}
                    </div>
                </div>

                <div className="text-right text-xs text-zinc-500">
                    <div>High: {max.toFixed(4)}</div>
                    <div>Low: {min.toFixed(4)}</div>
                </div>
            </div>

            <svg viewBox="0 0 100 45" className="h-28 w-full">
                <polyline
                    points={polyline}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-red-700"
                />
            </svg>

            <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
                <span>{points[0]?.date}</span>
                <span>{points[points.length - 1]?.date}</span>
            </div>
        </div>
    );
}

function RateComparison({ comparison }) {
    if (!comparison?.comparison?.length) return null;

    return (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3">
                <div className="text-sm font-semibold text-zinc-950">
                    FX Provider Rate Comparison
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                    Compares the main FX provider with a backup provider for better reliability.
                </div>
            </div>

            <div className="space-y-2">
                {comparison.comparison.map((item) => (
                    <div
                        key={item.code}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"
                    >
                        <div>
                            <div className="font-semibold text-zinc-900">{item.pair}</div>
                            <div className="text-zinc-400">
                                Difference: {Number(item.difference).toFixed(4)}
                            </div>
                        </div>

                        <div className="text-right text-zinc-500">
                            <div>
                                Frankfurter:{" "}
                                <span className="font-mono text-zinc-800">
                                    {Number(item.primary_rate).toFixed(4)}
                                </span>
                            </div>
                            <div>
                                Backup API:{" "}
                                <span className="font-mono text-zinc-800">
                                    {Number(item.backup_rate).toFixed(4)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ForexPage() {
    const [me, setMe] = useState(null);
    const [rates, setRates] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [history, setHistory] = useState(null);
    const [currency, setCurrency] = useState("USD");
    const [amount, setAmount] = useState("100");
    const [quote, setQuote] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quoting, setQuoting] = useState(false);
    const [buying, setBuying] = useState(false);
    const [error, setError] = useState("");
    const [returnStatus, setReturnStatus] = useState(null);
    const [riskAccepted, setRiskAccepted] = useState(false);

    const selectedRate = useMemo(() => {
        return rates?.rates?.find((r) => r.code === currency) ?? null;
    }, [rates, currency]);

    async function loadData() {
        setLoading(true);
        setError("");

        try {
            const [profile, fxRates, rateCompare, rateHistory, orderList] = await Promise.all([
                api.get("/api/auth/me"),
                api.get("/api/ong-xuan/forex/rates"),
                api.get("/api/ong-xuan/forex/rate-comparison").catch(() => null),
                api.get("/api/ong-xuan/forex/history").catch(() => null),
                api.get("/api/ong-xuan/forex/orders").catch(() => []),
            ]);

            setMe(profile);
            setRates(fxRates);
            setComparison(rateCompare);
            setHistory(rateHistory);
            setOrders(orderList);
        } catch (err) {
            setError(err.message || "Unable to load forex data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get("forex_status");

        if (status) {
            setReturnStatus({
                status,
                orderId: params.get("forex_order_id") || "",
            });

            window.history.replaceState({}, "", window.location.pathname);
        }

        loadData();
    }, []);

    async function getQuote(event) {
        event.preventDefault();
        setQuoting(true);
        setError("");
        setRiskAccepted(false);

        try {
            const data = await api.post("/api/ong-xuan/forex/quote", {
                currency,
                amount,
            });

            setQuote(data);
        } catch (err) {
            setError(err.message || "Unable to create quote");
        } finally {
            setQuoting(false);
        }
    }

    async function confirmBuy() {
        if (!quote) return;

        if (!riskAccepted) {
            setError("Please accept the FX risk acknowledgement before confirming the purchase.");
            return;
        }

        setBuying(true);
        setError("");

        try {
            const data = await api.post("/api/ong-xuan/forex/buy", {
                currency: quote.currency,
                amount: quote.amount,
            });

            if (data.approve_url) {
                window.location.href = data.approve_url;
                return;
            }

            setOrders((current) => [data.order, ...current]);
            setQuote(null);
            setRiskAccepted(false);
        } catch (err) {
            setError(err.message || "Unable to complete purchase");
        } finally {
            setBuying(false);
        }
    }

    return (
        <main className="flex-1 overflow-auto bg-gradient-to-br from-zinc-50 via-white to-red-50/40 p-6">
            <div className="mx-auto max-w-6xl">
                <StatusBanner
                    status={returnStatus?.status}
                    orderId={returnStatus?.orderId}
                    onDismiss={() => setReturnStatus(null)}
                />

                <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                                Ong Xuan · Forex
                            </div>

                            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                                StraitsFX
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                                Buy USD, EUR or GBP using Singapore Dollars. Rates are retrieved
                                from external FX APIs and purchases are linked to the customer
                                profile from PayPal login.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
                            <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                                Customer
                            </div>

                            <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {me?.user?.name ?? "PayPal Customer"}
                            </div>

                            <div className="font-mono text-xs text-zinc-500">
                                {me?.user?.email ?? "sandbox user"}
                            </div>
                        </div>
                    </div>
                </section>

                {error ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {error}
                    </div>
                ) : null}

                <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-950">
                                    Live FX Rates
                                </h2>

                                <p className="mt-1 text-xs text-zinc-500">
                                    {loading
                                        ? "Loading rates…"
                                        : `${rates?.source ?? "FX API"}${rates?.date ? ` · ${rates.date}` : ""}`}
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                className="px-3 py-2 text-xs"
                                onClick={loadData}
                                disabled={loading}
                            >
                                Refresh
                            </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {(rates?.rates ??
                                ["USD", "EUR", "GBP"].map((code) => ({
                                    code,
                                    pair: `${code}/SGD`,
                                    sgd_per_unit: 0,
                                }))).map((r) => (
                                <button
                                    key={r.code}
                                    onClick={() => {
                                        setCurrency(r.code);
                                        setQuote(null);
                                        setRiskAccepted(false);
                                    }}
                                    className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                                        currency === r.code
                                            ? "border-red-300 bg-red-50"
                                            : "border-zinc-200 bg-white"
                                    }`}
                                >
                                    <div className="text-xs font-medium text-zinc-500">
                                        {r.pair}
                                    </div>

                                    <div className="mt-2 text-2xl font-semibold text-zinc-950">
                                        {num(r.sgd_per_unit || 0)}
                                    </div>

                                    <div className="mt-1 text-xs text-zinc-400">
                                        SGD per 1 {r.code}
                                    </div>

                                    <div className="mt-3 text-xs leading-5 text-zinc-500">
                                        {currencyNotes[r.code]}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <form
                            onSubmit={getQuote}
                            className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                        >
                            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                <label className="block">
                                    <span className="text-xs font-medium text-zinc-500">
                                        Currency to buy
                                    </span>

                                    <select
                                        value={currency}
                                        onChange={(e) => {
                                            setCurrency(e.target.value);
                                            setQuote(null);
                                            setRiskAccepted(false);
                                        }}
                                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-300"
                                    >
                                        <option value="USD">USD/SGD</option>
                                        <option value="EUR">EUR/SGD</option>
                                        <option value="GBP">GBP/SGD</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-medium text-zinc-500">
                                        Amount to buy
                                    </span>

                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setQuote(null);
                                            setRiskAccepted(false);
                                        }}
                                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-300"
                                        placeholder="100"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                                    disabled={quoting || loading}
                                >
                                    {quoting ? "Checking…" : "Get quote"}
                                </button>
                            </div>

                            {selectedRate ? (
                                <div className="mt-3 text-xs text-zinc-500">
                                    Current display rate: 1 {currency} ={" "}
                                    {num(selectedRate.sgd_per_unit)} SGD
                                </div>
                            ) : null}
                        </form>

                        <MiniTrendChart history={history} currency={currency} />
                        <RateComparison comparison={comparison} />
                    </section>

                    <aside className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-zinc-950">
                            Purchase Summary
                        </h2>

                        {!quote ? (
                            <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                                Select a currency and get a quote first.
                            </div>
                        ) : (
                            <div className="mt-5 space-y-3">
                                <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                                    <div className="text-xs text-zinc-400">You are buying</div>

                                    <div className="mt-1 text-3xl font-semibold">
                                        {quote.amount} {quote.currency}
                                    </div>

                                    <div className="mt-1 text-xs text-zinc-400">
                                        {quote.currency_name} · {quote.pair}
                                    </div>
                                </div>

                                <div className="space-y-2 rounded-2xl border border-zinc-200 p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Quote ID</span>
                                        <span className="font-mono text-xs">
                                            {quote.quote_id}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Rate</span>
                                        <span className="font-mono">
                                            1 {quote.currency} = {num(quote.sgd_rate)} SGD
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">FX amount</span>
                                        <span className="font-mono">{money(quote.sgd_total)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Service fee</span>
                                        <span className="font-mono">{money(quote.service_fee)}</span>
                                    </div>

                                    <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold">
                                        <span>Total payable</span>
                                        <span className="font-mono">{money(quote.payable_sgd)}</span>
                                    </div>
                                </div>

                                <label className="flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
                                    <input
                                        type="checkbox"
                                        checked={riskAccepted}
                                        onChange={(e) => setRiskAccepted(e.target.checked)}
                                        className="mt-1"
                                    />
                                    <span>
                                        I understand that foreign exchange rates may fluctuate and
                                        the displayed quote is for demo purposes.
                                    </span>
                                </label>

                                <Button
                                    className="w-full rounded-xl py-3 text-sm"
                                    onClick={confirmBuy}
                                    disabled={buying || !riskAccepted}
                                >
                                    {buying ? "Processing…" : "Confirm Buy with PayPal"}
                                </Button>

                                <p className="text-center text-[11px] leading-5 text-zinc-400">
                                    Demo login will simulate a PayPal Sandbox purchase. Real PayPal
                                    credentials will redirect to Sandbox checkout.
                                </p>
                            </div>
                        )}
                    </aside>
                </div>

                <section className="mt-5 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-950">
                                Recent Forex Orders
                            </h2>

                            <p className="mt-1 text-xs text-zinc-500">
                                Stored in your current session for demo purposes.
                            </p>
                        </div>
                    </div>

                    {orders.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                            No forex orders yet.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-zinc-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-3">Order</th>
                                        <th className="px-4 py-3">Currency</th>
                                        <th className="px-4 py-3">Amount</th>
                                        <th className="px-4 py-3">Rate</th>
                                        <th className="px-4 py-3">Total SGD</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-zinc-100">
                                    {orders.map((o) => (
                                        <tr key={o.order_id}>
                                            <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                                                {o.order_id}
                                            </td>

                                            <td className="px-4 py-3 font-semibold">
                                                {o.currency}/SGD
                                            </td>

                                            <td className="px-4 py-3">
                                                {o.amount} {o.currency}
                                            </td>

                                            <td className="px-4 py-3 font-mono">
                                                {num(o.sgd_rate)}
                                            </td>

                                            <td className="px-4 py-3 font-mono">
                                                {money(o.payable_sgd)}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                                    {o.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}