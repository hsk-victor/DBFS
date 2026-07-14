import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { api } from "@/shared/lib/api";
import { fmtQty, fmtUsd } from "@/shared/lib/format";
function Seg({ value, options, onChange, }) {
    return (<div className="flex gap-0.5 rounded-[9px] bg-zinc-100 p-[3px]">
      {options.map((o) => (<button key={o.id} onClick={() => onChange(o.id)} className="cursor-pointer rounded-[7px] px-3.5 py-[5px] text-xs font-semibold" style={{
                background: value === o.id ? "#ffffff" : "transparent",
                color: value === o.id ? "#18181b" : "#71717a",
                boxShadow: value === o.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}>
          {o.label}
        </button>))}
    </div>);
}
export function TradeDialog({ trade, quote, fxRate, fxProvider, ownedQty, userEmail, merchantNote, onClose, onComplete, }) {
    const isSell = trade.side === "sell";
    const price = quote?.price ?? 0;
    const [otype, setOtype] = useState("market");
    const [mode, setMode] = useState("shares");
    const [qty, setQty] = useState(1);
    const [limit, setLimit] = useState(price ? price.toFixed(2) : "");
    const [cash, setCash] = useState("500");
    const [step, setStep] = useState("form");
    const [placed, setPlaced] = useState(null);
    const [error, setError] = useState("");
    const limitVal = parseFloat(limit) || 0;
    const effPrice = otype === "limit" && limitVal > 0 ? limitVal : price;
    const cashVal = Math.max(0, parseFloat(cash) || 0);
    const estShares = useMemo(() => {
        let s = mode === "cash" && effPrice > 0 ? cashVal / fxRate / effPrice : qty;
        if (isSell)
            s = Math.min(s, ownedQty);
        return s;
    }, [mode, effPrice, cashVal, fxRate, qty, isSell, ownedQty]);
    const usd = effPrice * estShares;
    const sgd = usd * fxRate;
    const submit = async () => {
        if (step !== "form")
            return;
        setStep("processing");
        setError("");
        try {
            const r = await api.post("/api/orders", {
                symbol: trade.sym,
                side: trade.side,
                order_type: otype,
                mode,
                qty,
                cash_sgd: cashVal,
                limit_price: limitVal,
            });
            if (r.approve_url) {
                // Real PayPal checkout — approve on PayPal, bounce back to the app
                window.location.href = r.approve_url;
                return;
            }
            setPlaced(r.order);
            setStep("done");
            onComplete();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Order failed");
            setStep("form");
        }
    };
    const isLimit = otype === "limit";
    const doneLimit = placed?.status === "working";
    return (<Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogPopup>
        {step !== "done" ? (<>
            <div className="flex items-center gap-[11px]">
              <div className="flex size-9 items-center justify-center rounded-[9px] bg-zinc-900 font-mono text-xs font-semibold text-white">
                {trade.sym.slice(0, 2)}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{isSell ? "Sell" : "Buy"} {trade.sym}</div>
                <div className="text-xs text-zinc-500">{trade.name} · live quote</div>
              </div>
            </div>

            <div className="mt-[18px] flex items-center justify-between">
              <div className="text-[13px] font-medium text-zinc-700">Order type</div>
              <Seg value={otype} onChange={setOtype} options={[{ id: "market", label: "Market" }, { id: "limit", label: "Limit" }]}/>
            </div>

            {isLimit && (<>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-zinc-700">Limit price</div>
                  <div className="flex items-center gap-1.5 rounded-[9px] border border-zinc-200 px-2.5 py-[5px]">
                    <span className="font-mono text-xs text-zinc-400">USD</span>
                    <input type="number" step="0.01" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} className="w-20 border-none bg-transparent text-right font-mono text-[13.5px] font-semibold outline-none"/>
                  </div>
                </div>
                <div className="mt-[5px] text-right text-[11px] text-zinc-400">
                  Checked on manual refresh · fills at {limitVal > 0 ? fmtUsd(limitVal) : "—"} or better · mkt {fmtUsd(price)}
                </div>
              </>)}

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[13px] font-medium text-zinc-700">{isSell ? "Sell in" : "Buy in"}</div>
              <Seg value={mode} onChange={setMode} options={[{ id: "shares", label: "Shares" }, { id: "cash", label: "Cash" }]}/>
            </div>

            {mode === "shares" ? (<div className="mt-3 flex items-center justify-between">
                <div className="text-[13px] font-medium text-zinc-700">Quantity</div>
                <div className="flex items-center gap-0.5 rounded-[9px] border border-zinc-200 p-0.5">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-7 w-[30px] cursor-pointer rounded-[7px] text-[15px] text-zinc-600 hover:bg-zinc-100">−</button>
                  <div className="min-w-[34px] text-center font-mono text-sm font-semibold">{qty}</div>
                  <button onClick={() => setQty((q) => Math.min(isSell ? Math.max(1, Math.floor(ownedQty)) : 999, q + 1))} className="h-7 w-[30px] cursor-pointer rounded-[7px] text-[15px] text-zinc-600 hover:bg-zinc-100">+</button>
                </div>
              </div>) : (<>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-zinc-700">Amount</div>
                  <div className="flex items-center gap-1.5 rounded-[9px] border border-zinc-200 px-2.5 py-[5px]">
                    <span className="font-mono text-xs text-zinc-400">SGD</span>
                    <input type="number" step="50" min="0" value={cash} onChange={(e) => setCash(e.target.value)} className="w-20 border-none bg-transparent text-right font-mono text-[13.5px] font-semibold outline-none"/>
                  </div>
                </div>
                <div className="mt-[5px] text-right text-[11px] text-zinc-400">
                  ≈ {estShares.toFixed(4)} shares · fractional supported
                </div>
              </>)}

            <div className="mt-3.5 border-t border-zinc-100">
              {[
                [isLimit ? "Limit price" : "Price · Finnhub", fmtUsd(effPrice)],
                [mode === "cash" ? "Est. shares" : "Quantity", mode === "cash" ? estShares.toFixed(4) : String(qty)],
                ["Subtotal (USD)", fmtUsd(usd)],
                [`FX · ${fxProvider}`, `1 USD = S$${fxRate.toFixed(4)}`],
            ].map(([k, v]) => (<div key={k} className="flex justify-between border-b border-zinc-100 py-[9px] text-[12.5px]">
                  <span className="text-zinc-500">{k}</span>
                  <span className="font-mono font-medium">{v}</span>
                </div>))}
            </div>

            <div className="mt-3.5 flex items-baseline justify-between">
              <div className="text-[13px] font-semibold">{isSell ? "You receive" : "You pay"}</div>
              <div className="font-mono text-[22px] font-bold tracking-tight">S${sgd.toFixed(2)}</div>
            </div>
            <div className="mt-1 text-right text-[11px] text-zinc-400">
              {isSell ? "Payout in SGD via PayPal Sandbox" : "Settled in SGD via PayPal Sandbox"}
            </div>

            {error && <div className="mt-2 text-center text-[11.5px] text-red-800">{error}</div>}

            <Button onClick={submit} disabled={step === "processing" || estShares <= 0} className="mt-4 w-full rounded-[10px] py-[11px] text-[13.5px]">
              {step === "processing" ? "Processing…"
                : isLimit ? "Place limit order · PayPal"
                    : isSell ? "Sell · PayPal payout" : "Continue with PayPal"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="mt-2 w-full rounded-[9px] py-2 font-medium">
              Cancel
            </Button>
          </>) : (<div className="px-0 pb-0.5 pt-2 text-center">
            <div className="mx-auto mb-3 flex size-[46px] items-center justify-center rounded-full text-xl" style={{
                background: doneLimit ? "#fef9c3" : "#dcfce7",
                color: doneLimit ? "#854d0e" : "#166534",
            }}>
              {doneLimit ? "◷" : "✓"}
            </div>
            <div className="text-base font-semibold">{doneLimit ? "Limit order working" : "Order filled"}</div>
            <div className="mt-1.5 text-[13px] text-zinc-500">
              {fmtQty(placed?.shares ?? 0)} × {trade.sym} · S${placed?.sgd_total.toFixed(2)}
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-400">
              {doneLimit
                ? `Fills when ${trade.sym} trades at ${fmtUsd(placed?.price_usd ?? 0)} or better · GTC`
                : isSell ? "Executed at market · proceeds paid out in SGD"
                    : "Executed at market · funds captured in SGD"}
            </div>
            <div className="mt-2 text-[11.5px] text-zinc-500">
              {doneLimit ? "No funds move until a fresh quote crosses the limit"
                : isSell ? `Payout sent to ${userEmail}` : merchantNote}
            </div>
            <div className="mt-2 font-mono text-[11px] text-zinc-400">
              PayPal order {placed?.order_id} · sandbox
            </div>
            <Button onClick={onClose} className="mt-[18px] w-full rounded-[10px] py-2.5 text-[13px]">
              Done
            </Button>
          </div>)}
      </DialogPopup>
    </Dialog>);
}
