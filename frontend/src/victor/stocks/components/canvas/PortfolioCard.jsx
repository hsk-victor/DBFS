import { ChevronRight } from "lucide-react";
import { CardFrame } from "@/victor/stocks/components/canvas/CardFrame";
import { fmtPct, fmtQty, fmtSgd, fmtUsd } from "@/shared/lib/format";
function OrderRow({ o, onCancel }) {
    const buy = o.side === "buy";
    const working = o.status === "working";
    return (<div className="flex items-center gap-2 border-b border-zinc-100 py-[7px]" style={{ opacity: o.status === "cancelled" ? 0.55 : 1 }}>
      <span className="shrink-0 rounded-[5px] px-[7px] py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider" style={{ background: buy ? "#dcfce7" : "#fee2e2", color: buy ? "#166534" : "#991b1b" }}>
        {buy ? "BUY" : "SELL"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11.5px] font-semibold">
          {o.symbol} · {fmtQty(o.shares)} @ {fmtUsd(o.price_usd)}
        </div>
        <div className="font-mono text-[10px] text-zinc-400">
          {o.order_type === "limit" ? "Limit" : "Market"} · S${o.sgd_total.toFixed(2)} · {o.time_label}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-[5px]">
        <span className="size-1.5 rounded-full" style={{
            background: working ? "#eab308"
                : o.status === "filled" ? "#22c55e"
                    : o.status === "pending_approval" ? "#eab308" : "#d4d4d8",
        }}/>
        <span className="font-mono text-[10px] text-zinc-500">
          {o.status === "pending_approval" ? "approving" : o.status}
        </span>
      </div>
      {working && onCancel && (<button data-nodrag="1" onClick={() => onCancel(o.order_id)} className="shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 py-[3px] text-[10.5px] font-semibold text-zinc-500 hover:border-red-200 hover:bg-red-100 hover:text-red-800">
          Cancel
        </button>)}
    </div>);
}
export function PortfolioCard({ card, holdings, orders, fxRate, zoom, loading, onFront, onPatch, onRemove, onSell, onCancelOrder, }) {
    const totalUsd = holdings.reduce((s, h) => s + h.value_usd, 0);
    const costUsd = holdings.reduce((s, h) => s + h.qty * h.avg_price, 0);
    const dayUsd = holdings.reduce((s, h) => s + h.value_usd * (h.change_pct / 100), 0);
    const retUsd = totalUsd - costUsd;
    const dayUp = dayUsd >= 0;
    const open = orders.filter((o) => o.status === "working" || o.status === "pending_approval");
    const done = orders.filter((o) => o.status !== "working" && o.status !== "pending_approval");
    const header = (<>
      <div className="flex items-center gap-2.5 pr-14">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-zinc-900 bg-white font-mono text-[11px] font-semibold text-zinc-900">
          PF
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold tracking-tight">Portfolio</div>
          <div className="truncate text-xs text-zinc-500">
            {holdings.length} holding{holdings.length === 1 ? "" : "s"} · marked to market
          </div>
        </div>
      </div>
      {loading ? (<div className="mt-3">
          <div className="anim-pulse h-[26px] w-40 rounded-[7px] bg-zinc-100"/>
          <div className="anim-pulse mt-2 h-3 w-52 rounded-[5px] bg-zinc-100"/>
        </div>) : (<>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="font-mono text-[26px] font-bold tracking-tight">{fmtSgd(totalUsd * fxRate)}</div>
            <div className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold" style={{ color: dayUp ? "#166534" : "#991b1b", background: dayUp ? "#dcfce7" : "#fee2e2" }}>
              {dayUp ? "+" : "−"}S${Math.abs(dayUsd * fxRate).toFixed(2)} today
            </div>
          </div>
          <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
            {retUsd >= 0 ? "+" : "−"}S${Math.abs(retUsd * fxRate).toFixed(2)} all-time · cost {fmtSgd(costUsd * fxRate)}
          </div>
        </>)}
    </>);
    return (<CardFrame card={card} zoom={zoom} baseW={400} baseH={356} onFront={onFront} onPatch={onPatch} onRemove={onRemove} header={header}>
      <div className="min-h-0 flex-1 overflow-auto border-t border-zinc-100 px-4 pb-2.5 pt-1.5" data-nodrag="1">
        {holdings.map((h) => (<div key={h.symbol} className="flex items-center gap-2.5 border-b border-zinc-100 py-[9px]">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 font-mono text-[10px] font-semibold text-white">
              {h.symbol.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{h.symbol}</div>
              <div className="font-mono text-[10.5px] text-zinc-400">
                {fmtQty(h.qty)} sh · avg {fmtUsd(h.avg_price)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[12.5px] font-semibold">{fmtSgd(h.value_usd * fxRate)}</div>
              <div className="font-mono text-[10.5px] font-semibold" style={{ color: h.pl_pct >= 0 ? "#166534" : "#991b1b" }}>
                {fmtPct(h.pl_pct)}
              </div>
            </div>
            <button onClick={() => onSell(h.symbol)} className="shrink-0 cursor-pointer rounded-[7px] border border-zinc-200 bg-white px-3 py-[5px] text-[11.5px] font-semibold hover:bg-zinc-100">
              Sell
            </button>
          </div>))}
        {!loading && holdings.length === 0 && (<div className="py-[18px] text-center text-[12.5px] text-zinc-400">
            No holdings yet — buy a stock to get started
          </div>)}

        {/* open orders */}
        <button onClick={() => onPatch({ showOrders: !card.showOrders })} className="flex w-full cursor-pointer items-center gap-[7px] pb-[7px] pt-[11px] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">
          <ChevronRight className="size-2.5 transition-transform" style={{ transform: card.showOrders ? "rotate(90deg)" : "none" }}/>
          <span>Open orders</span>
          <span className="rounded-full px-[7px] py-px font-mono text-[10px]" style={{
            background: open.length ? "#fef9c3" : "#f4f4f5",
            color: open.length ? "#854d0e" : "#71717a",
        }}>
            {open.length}
          </span>
        </button>
        {card.showOrders && (open.length ? open.map((o) => <OrderRow key={o.order_id} o={o} onCancel={onCancelOrder}/>)
            : <div className="pb-1 pt-2 text-[11.5px] text-zinc-400">No open orders — limit orders appear here until they fill</div>)}

        {/* completed trades */}
        <button onClick={() => onPatch({ showTrades: !card.showTrades })} className="flex w-full cursor-pointer items-center gap-[7px] pb-[7px] pt-[11px] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">
          <ChevronRight className="size-2.5 transition-transform" style={{ transform: card.showTrades ? "rotate(90deg)" : "none" }}/>
          <span>Completed trades</span>
          <span className="rounded-full bg-zinc-100 px-[7px] py-px font-mono text-[10px]">{done.length}</span>
        </button>
        {card.showTrades && (done.length ? done.map((o) => <OrderRow key={o.order_id} o={o}/>)
            : <div className="pb-1 pt-2 text-[11.5px] text-zinc-400">No completed trades yet</div>)}
      </div>
    </CardFrame>);
}
