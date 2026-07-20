import { useMemo } from "react";
import { CardFrame } from "@/victor/stocks/components/canvas/CardFrame";
import { Sparkline } from "@/victor/stocks/components/charts/Sparkline";
import { Button } from "@/shared/components/ui/button";
import { fmtPct, fmtSgd, fmtUsd } from "@/shared/lib/format";
import { CryptoChartPanel } from "@/zavier/crypto/components/CryptoChartPanel";
import { CryptoDataGrid } from "@/zavier/crypto/components/CryptoDataGrid";
import { CryptoNewsList } from "@/zavier/crypto/components/CryptoNewsList";
import { CryptoTabs } from "@/zavier/crypto/components/CryptoTabs";
import { TABS } from "@/zavier/crypto/constants";
import { useCryptoDetails } from "@/zavier/crypto/hooks/useCryptoDetails";
import { mapSpark } from "@/zavier/crypto/lib/cryptoFormat";

export function CryptoCard({ card, coin, quote, fxRate, zoom, loading, onFront, onPatch, onRemove, onBuy }) {
    const symbol = card.sym;
    const tab = card.tab ?? "overview";
    const details = useCryptoDetails(symbol, coin, tab);
    const changePct = Number(quote?.change_pct ?? 0);
    const priceUsd = Number(quote?.price ?? 0);
    const up = changePct >= 0;
    const sparklineData = useMemo(() => mapSpark(details.spark), [details.spark]);

    const header = (
        <>
            <div className="flex items-center gap-2.5 pr-14">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-zinc-900 font-mono text-xs font-semibold text-white">
                    {symbol.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tracking-tight">{symbol}</div>
                    <div className="truncate text-xs text-zinc-500">{coin?.name ?? symbol} · live quote</div>
                </div>
            </div>

            {loading || !quote ? (
                <div className="mt-3">
                    <div className="anim-pulse h-[26px] w-[132px] rounded-[7px] bg-zinc-100" />
                    <div className="anim-pulse mt-2 h-3 w-24 rounded-[5px] bg-zinc-100" />
                    <div className="anim-pulse mt-2.5 h-8 rounded-md bg-zinc-100" />
                </div>
            ) : (
                <>
                    <div className="mt-3 flex items-baseline gap-2">
                        <div className="font-mono text-[26px] font-bold tracking-tight">{fmtSgd(priceUsd * fxRate)}</div>
                        <div
                            className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold"
                            style={{ color: up ? "#166534" : "#991b1b", background: up ? "#dcfce7" : "#fee2e2" }}
                        >
                            {fmtPct(changePct)}
                        </div>
                    </div>
                    <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
                        ≈ {fmtUsd(priceUsd)} USD{quote.source !== "live" ? " · cached" : ""}
                    </div>
                    <Sparkline candles={sparklineData} up={up} fxRate={fxRate} />
                </>
            )}
        </>
    );

    return (
        <CardFrame card={card} zoom={zoom} onFront={onFront} onPatch={onPatch} onRemove={onRemove} header={header}>
            <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-100">
                <div className="mx-3.5 mt-2.5 flex shrink-0 gap-0.5" data-nodrag="1">
                    <CryptoTabs value={tab} tabs={TABS} onChange={(value) => onPatch({ tab: value })} />
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-4 pb-1.5 pt-3" data-nodrag="1">
                    {tab === "overview" && (
                        <>
                            <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded-full px-2 py-[3px] font-semibold uppercase tracking-wider text-[10px] ${changePct >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                    {changePct >= 0 ? "Bullish" : "Bearish"}
                                </span>
                                <span className="font-mono text-[10.5px] text-zinc-400">
                                    {details.loading ? "loading brief" : "offline brief"}
                                </span>
                            </div>
                            <p className="m-0 text-[13px] leading-relaxed text-zinc-700">
                                {details.eod?.description ?? `${coin?.name ?? symbol} market view and intraday movement.`}
                            </p>
                            <div className="mt-2.5 border-t border-dashed border-zinc-200 pt-2 text-[10.5px] text-zinc-400">
                                Crypto-generated · Not financial advice
                            </div>
                        </>
                    )}

                    {tab === "news" && <CryptoNewsList news={details.news} loading={details.newsLoading} error={details.newsError} />}

                    {tab === "chart" && <CryptoChartPanel candles={details.candles} loading={details.loading} fxRate={fxRate} />}

                    {tab === "data" && <CryptoDataGrid metrics={details.metrics} description={details.fund?.description} loading={details.loading} />}
                </div>

                {details.error && <div className="px-4 pb-2 text-[11px] text-red-800">{details.error}</div>}

                <div className="shrink-0 px-3.5 pb-3.5 pt-2.5" data-nodrag="1">
                    <Button onClick={onBuy} className="w-full rounded-[9px] py-[9px] text-[13px]">
                        Buy {symbol}
                    </Button>
                </div>
            </div>
        </CardFrame>
    );
}