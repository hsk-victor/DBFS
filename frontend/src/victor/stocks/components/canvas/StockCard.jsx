import { useEffect, useState } from "react";
import { CardFrame } from "@/victor/stocks/components/canvas/CardFrame";
import { Candles } from "@/victor/stocks/components/charts/Candles";
import { Button } from "@/shared/components/ui/button";
import { api } from "@/shared/lib/api";
import { fmtPct, fmtSgd, fmtUsd, SENT_BG, SENT_FG, timeAgo } from "@/shared/lib/format";
const TABS = [
    { id: "ai", label: "AI" },
    { id: "news", label: "News" },
    { id: "fund", label: "Data" },
];
const RANGES = [
    { id: "1D", label: "1D" },
    { id: "1M", label: "1M" },
    { id: "1Y", label: "1Y" },
    { id: "custom", label: "Custom" },
];
function SentBadge({ tag, small }) {
    return (<span className={`rounded-full font-semibold uppercase tracking-wider ${small ? "px-[7px] py-0.5 text-[9.5px]" : "px-2 py-[3px] text-[10px]"}`} style={{ background: SENT_BG[tag], color: SENT_FG[tag] }}>
      {tag}
    </span>);
}
export function StockCard({ card, name, quote, fxRate, zoom, loading, onFront, onPatch, onRemove, onBuy, }) {
    const sym = card.sym;
    const tab = TABS.some((item) => item.id === card.tab) ? card.tab : "ai";
    const range = card.range ?? "1M";
    const [news, setNews] = useState(null);
    const [candles, setCandles] = useState({});
    const [fund, setFund] = useState(null);
    const [ai, setAi] = useState(null);
    const [aiErr, setAiErr] = useState(false);
    // Lazy-load per tab, cached in card state for the session
    useEffect(() => {
        if (tab === "news" && !news) {
            api.get(`/api/market/news/${sym}`).then((r) => setNews(r.items)).catch(() => setNews([]));
        }
        if (tab === "fund" && !fund) {
            api.get(`/api/market/fundamentals/${sym}`).then(setFund).catch(() => { });
        }
        if ((tab === "ai" || tab === "news") && !ai && !aiErr) {
            api.get(`/api/ai/analysis/${sym}`).then(setAi).catch(() => setAiErr(true));
        }
    }, [tab, sym, news, fund, ai, aiErr]);
    const chartKey = range === "custom" ? `custom:${card.from}:${card.to}` : range;
    // The detailed candlestick chart now lives in the card header.
    useEffect(() => {
        if (Object.prototype.hasOwnProperty.call(candles, chartKey))
            return;
        const qs = range === "custom"
            ? `?range=custom&from=${card.from ?? "2026-06-12"}&to=${card.to ?? "2026-07-12"}`
            : `?range=${range}`;
        api.get(`/api/market/candles/${sym}${qs}`)
            .then((response) => setCandles((previous) => ({ ...previous, [chartKey]: response.candles })))
            .catch(() => setCandles((previous) => ({ ...previous, [chartKey]: [] })));
    }, [sym, range, card.from, card.to, chartKey, candles]);
    const up = (quote?.change_pct ?? 0) >= 0;
    const targetPct = fund?.target && quote ? Math.min(100, Math.round((quote.price / fund.target) * 100)) : null;
    const header = (<>
      <div className="flex items-center gap-2.5 pr-14">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-zinc-900 font-mono text-xs font-semibold text-white">
          {sym.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold tracking-tight">{sym}</div>
          <div className="truncate text-xs text-zinc-500">{name}</div>
        </div>
      </div>
      {loading || !quote ? (<div className="mt-3">
          <div className="anim-pulse h-[26px] w-[132px] rounded-[7px] bg-zinc-100"/>
          <div className="anim-pulse mt-2 h-3 w-24 rounded-[5px] bg-zinc-100"/>
          <div className="anim-pulse mt-2.5 h-8 rounded-md bg-zinc-100"/>
        </div>) : (<>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="font-mono text-[26px] font-bold tracking-tight">
              {fmtSgd(quote.price * fxRate)}
            </div>
            <div className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold" style={{ color: up ? "#166534" : "#991b1b", background: up ? "#dcfce7" : "#fee2e2" }}>
              {fmtPct(quote.change_pct)}
            </div>
          </div>
          <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
            ≈ {fmtUsd(quote.price)} USD{quote.source !== "live" ? " · cached" : ""}
          </div>
          <div className="mt-2.5" data-nodrag="1">
            <div className="mb-1.5 flex items-center gap-1">
              {RANGES.map((item) => (<button key={item.id} onClick={() => onPatch({ range: item.id })} className="cursor-pointer rounded-full px-2 py-[3px] font-mono text-[10.5px] hover:bg-zinc-100" style={{
                  background: range === item.id ? "#f4f4f5" : "transparent",
                  color: range === item.id ? "#18181b" : "#a1a1aa",
                  fontWeight: range === item.id ? 600 : 400,
              }}>
                  {item.label}
                </button>))}
              <span className="flex-1"/>
              <span className="font-mono text-[10px] text-zinc-400">Twelve Data</span>
            </div>
            {range === "custom" && (<div className="mb-1.5 flex items-center gap-1.5">
                <input type="date" value={card.from ?? "2026-06-12"} onChange={(event) => onPatch({ from: event.target.value })} className="min-w-0 flex-1 rounded-[7px] border border-zinc-200 bg-white px-[7px] py-1 font-mono text-[10.5px] text-zinc-700"/>
                <span className="text-[11px] text-zinc-400">→</span>
                <input type="date" value={card.to ?? "2026-07-12"} onChange={(event) => onPatch({ to: event.target.value })} className="min-w-0 flex-1 rounded-[7px] border border-zinc-200 bg-white px-[7px] py-1 font-mono text-[10.5px] text-zinc-700"/>
              </div>)}
            <div className="flex h-[90px]">
              {Object.prototype.hasOwnProperty.call(candles, chartKey)
                  ? <Candles candles={candles[chartKey]} fxRate={fxRate}/>
                  : <div className="anim-pulse flex-1 rounded bg-zinc-100"/>}
            </div>
          </div>
        </>)}
    </>);
    return (<CardFrame card={card} zoom={zoom} onFront={onFront} onPatch={onPatch} onRemove={onRemove} header={header}>
      <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-100">
        {/* tabs */}
        <div className="mx-3.5 mt-2.5 flex shrink-0 gap-0.5" data-nodrag="1">
          {TABS.map((t) => (<button key={t.id} onClick={() => onPatch({ tab: t.id })} className="flex-1 cursor-pointer py-1.5 text-xs font-semibold" style={{
                color: tab === t.id ? "#18181b" : "#71717a",
                borderBottom: tab === t.id ? "2px solid #18181b" : "2px solid transparent",
            }}>
              {t.label}
            </button>))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-1.5 pt-3" data-nodrag="1">
          {tab === "ai" && (ai ? (<>
                <div className="mb-2 flex items-center gap-2">
                  <SentBadge tag={ai.tag}/>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    {ai.model === "demo" ? "offline brief" : ai.model}
                    {ai.source === "cached" ? " · cached" : ""}
                  </span>
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-zinc-700">{ai.analysis}</p>
                <div className="mt-2.5 border-t border-dashed border-zinc-200 pt-2 text-[10.5px] text-zinc-400">
                  AI-generated · Not financial advice
                </div>
              </>) : aiErr ? (<div className="py-4 text-center text-xs text-zinc-400">AI analysis unavailable</div>) : (<div className="space-y-2">
                <div className="anim-pulse h-4 w-3/4 rounded bg-zinc-100"/>
                <div className="anim-pulse h-4 rounded bg-zinc-100"/>
                <div className="anim-pulse h-4 w-5/6 rounded bg-zinc-100"/>
              </div>))}

          {tab === "news" && (news === null ? (<div className="space-y-2">
                <div className="anim-pulse h-10 rounded bg-zinc-100"/>
                <div className="anim-pulse h-10 rounded bg-zinc-100"/>
              </div>) : news.length === 0 ? (<div className="py-4 text-center text-xs text-zinc-400">No recent headlines</div>) : (news.slice(0, 5).map((n, i) => (<a key={i} href={n.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 border-b border-zinc-100 py-[7px] no-underline">
                  <span className="mt-[1px] shrink-0">
                    <SentBadge tag={ai?.news_tags?.[i] ?? "Neutral"} small/>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium leading-snug text-zinc-900">{n.headline}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-zinc-400">
                      {n.source} · {timeAgo(n.datetime)}
                    </span>
                  </span>
                </a>))))}

          {tab === "fund" && (fund ? (<>
                <div className="grid grid-cols-2 gap-2">
                  {fund.metrics.map((f) => (<div key={f.label} className="rounded-[9px] border border-zinc-100 px-2.5 py-2">
                      <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">{f.label}</div>
                      <div className="mt-[3px] font-mono text-[13.5px] font-semibold" style={{ color: f.value.startsWith("-") ? "#991b1b" : "#18181b" }}>
                        {f.value}
                      </div>
                    </div>))}
                </div>
                {targetPct !== null && fund.target && quote && (<div className="mt-2.5 flex items-center gap-2 rounded-[9px] border border-zinc-100 px-2.5 py-2">
                    <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                      Analyst target
                    </span>
                    <div className="relative h-1.5 flex-1 rounded-full bg-zinc-100">
                      <div className="absolute left-0 top-0 h-full rounded-full bg-zinc-900" style={{ width: `${targetPct}%` }}/>
                      <div className="absolute -top-[3px] h-3 w-0.5 bg-zinc-900" style={{ left: `${targetPct}%`, marginLeft: -1 }}/>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-semibold">
                      ${fund.target.toFixed(0)} ({fund.target >= quote.price ? "+" : ""}
                      {((fund.target / quote.price - 1) * 100).toFixed(1)}%)
                    </span>
                  </div>)}
                <div className="mt-2.5 border-t border-dashed border-zinc-200 pt-2 text-[10.5px] text-zinc-400">
                  FMP · key metrics &amp; price targets
                </div>
              </>) : (<div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="anim-pulse h-12 rounded-[9px] bg-zinc-100"/>))}
              </div>))}
        </div>

        <div className="shrink-0 px-3.5 pb-3.5 pt-2.5" data-nodrag="1">
          <Button onClick={onBuy} className="w-full rounded-[9px] py-[9px] text-[13px]">
            Buy {sym}
          </Button>
        </div>
      </div>
    </CardFrame>);
}
