import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { fmtPct, fmtSgd, fmtUsd } from "@/shared/lib/format";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";

function Seg({ value, options, onChange }) {
    return (
        <div className="flex gap-0.5 rounded-[9px] bg-zinc-100 p-[3px]">
            {options.map((option) => (
                <button
                    key={option.id}
                    onClick={() => onChange(option.id)}
                    className="cursor-pointer rounded-[7px] px-3.5 py-[5px] text-xs font-semibold"
                    style={{
                        background: value === option.id ? "#ffffff" : "transparent",
                        color: value === option.id ? "#18181b" : "#71717a",
                        boxShadow: value === option.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function CryptoBuyDialog({ coin, quote, fxRate, onClose, onSuccess }) {
    const side = coin?.side === "sell" ? "sell" : "buy";
    const isSell = side === "sell";
    const maxQty = Number(coin?.maxQty ?? 0);
    const [mode, setMode] = useState("shares");
    const [qty, setQty] = useState(1);
    const [cash, setCash] = useState("500");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const price = Number(quote?.price ?? 0);
    const changePct = Number(quote?.change_pct ?? 0);
    const cashVal = Math.max(0, Number.parseFloat(cash) || 0);
    const effectiveMode = isSell ? "shares" : mode;
    const estQty = useMemo(() => (effectiveMode === "cash" && price > 0 ? cashVal / fxRate / price : qty), [effectiveMode, cashVal, fxRate, price, qty]);
    const usd = estQty * price;
    const sgd = usd * fxRate;

    const submit = async () => {
        if (submitting)
            return;
        setSubmitting(true);
        setError("");
        try {
            const payload = {
                symbol: coin?.symbol,
                side,
                order_type: "market",
                mode: effectiveMode,
                qty,
                cash_sgd: cashVal,
                price_usd: price,
                fx_rate: fxRate,
            };
            const response = await cryptoApi.order(payload);
            if (response?.approve_url) {
                window.location.href = response.approve_url;
                return;
            }
            onSuccess?.(response);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Order failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogPopup className="w-[420px] max-w-[calc(100vw-24px)] p-[22px]">
                <div className="flex items-center gap-[11px]">
                    <div className="flex size-9 items-center justify-center rounded-[9px] bg-zinc-900 font-mono text-xs font-semibold text-white">
                        {coin?.symbol?.slice(0, 2) ?? "CR"}
                    </div>
                    <div>
                        <div className="text-[15px] font-semibold">{isSell ? "Sell" : "Buy"} {coin?.symbol ?? "Crypto"}</div>
                        <div className="text-xs text-zinc-500">{coin?.name ?? coin?.symbol ?? "Asset"} · {isSell ? "payout preview" : "preview only"}</div>
                    </div>
                </div>

                <div className="mt-3.5 flex items-baseline gap-2">
                    <div className="font-mono text-[28px] font-bold tracking-tight">{fmtSgd(price * fxRate)}</div>
                    <div
                        className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold"
                        style={{ color: changePct >= 0 ? "#166534" : "#991b1b", background: changePct >= 0 ? "#dcfce7" : "#fee2e2" }}
                    >
                        {fmtPct(changePct)}
                    </div>
                </div>
                <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
                    ≈ {fmtUsd(price)} USD{quote?.source !== "live" ? " · cached" : ""}
                </div>

                {!isSell && (
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-[13px] font-medium text-zinc-700">Buy in</div>
                        <Seg value={mode} onChange={setMode} options={[{ id: "shares", label: "Shares" }, { id: "cash", label: "Cash" }]} />
                    </div>
                )}

                {isSell && (
                    <div className="mt-4 rounded-[9px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11.5px] text-zinc-600">
                        Available: {maxQty.toFixed(6)} {coin?.symbol ?? "units"}
                    </div>
                )}

                {effectiveMode === "shares" ? (
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-[13px] font-medium text-zinc-700">Quantity</div>
                        <div className="flex items-center gap-1.5 rounded-[9px] border border-zinc-200 px-2.5 py-[5px]">
                            <span className="font-mono text-xs text-zinc-400">{coin?.symbol ?? "COIN"}</span>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={qty}
                                onChange={(event) => setQty(Math.max(0, Number.parseFloat(event.target.value) || 0))}
                                className="w-24 border-none bg-transparent text-right font-mono text-[13.5px] font-semibold outline-none"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 flex items-center justify-between">
                            <div className="text-[13px] font-medium text-zinc-700">Amount</div>
                            <div className="flex items-center gap-1.5 rounded-[9px] border border-zinc-200 px-2.5 py-[5px]">
                                <span className="font-mono text-xs text-zinc-400">SGD</span>
                                <input
                                    type="number"
                                    step="50"
                                    min="0"
                                    value={cash}
                                    onChange={(event) => setCash(event.target.value)}
                                    className="w-20 border-none bg-transparent text-right font-mono text-[13.5px] font-semibold outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-[5px] text-right text-[11px] text-zinc-400">
                            ≈ {estQty.toFixed(6)} {coin?.symbol ?? "units"}
                        </div>
                    </>
                )}

                <div className="mt-3.5 border-t border-zinc-100">
                    {[
                        ["Price", fmtUsd(price)],
                        [effectiveMode === "cash" ? "Est. qty" : "Quantity", effectiveMode === "cash" ? estQty.toFixed(6) : String(qty)],
                        ["Subtotal (USD)", fmtUsd(usd)],
                        ["FX", `1 USD = S$${fxRate.toFixed(4)}`],
                    ].map(([label, value]) => (
                        <div key={label} className="flex justify-between border-b border-zinc-100 py-[9px] text-[12.5px]">
                            <span className="text-zinc-500">{label}</span>
                            <span className="font-mono font-medium">{value}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-3.5 flex items-baseline justify-between">
                    <div className="text-[13px] font-semibold">{isSell ? "You receive" : "You pay"}</div>
                    <div className="font-mono text-[22px] font-bold tracking-tight">S${sgd.toFixed(2)}</div>
                </div>
                <div className="mt-1 text-right text-[11px] text-zinc-400">
                    {isSell ? "Market sell routes through /api/crypto/orders and PayPal payouts." : "Market buy routes through /api/crypto/orders."}
                </div>

                {error && <div className="mt-2 text-center text-[11.5px] text-red-800">{error}</div>}

                <Button onClick={submit} disabled={submitting || estQty <= 0 || (isSell && estQty > maxQty + 1e-9)} className="mt-4 w-full rounded-[10px] py-[11px] text-[13.5px]">
                    {submitting ? "Processing..." : isSell ? "Sell with PayPal payout" : "Continue with PayPal"}
                </Button>
                <Button variant="ghost" onClick={onClose} className="mt-2 w-full rounded-[9px] py-2 font-medium">
                    Cancel
                </Button>
            </DialogPopup>
        </Dialog>
    );
}