import { useMemo } from "react";
import { CardFrame } from "@/victor/stocks/components/canvas/CardFrame";
import { Sparkline } from "@/victor/stocks/components/charts/Sparkline";
import { Button } from "@/shared/components/ui/button";
import { fmtPct, fmtSgd, fmtUsd } from "@/shared/lib/format";
import { CryptoChartPanel } from "@/zavier/crypto/components/CryptoChartPanel";
import { CryptoNewsList } from "@/zavier/crypto/components/CryptoNewsList";
import { CryptoTabs } from "@/zavier/crypto/components/CryptoTabs";
import { TABS } from "@/zavier/crypto/constants";
import { useCryptoDetails } from "@/zavier/crypto/hooks/useCryptoDetails";
import { mapSpark } from "@/zavier/crypto/lib/cryptoFormat";

export function CryptoCard({ card, coin, quote, fxRate, zoom, loading, onFront, onPatch, onRemove, onBuy, onSell }) {
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
                            <div className="mt-3 border-t border-zinc-100 pt-3">
                                <div className="mb-2 font-mono text-[10.5px] text-zinc-400">Fundamentals</div>
                                {details.fund ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[["Name", details.fund.name ?? coin?.name ?? symbol], ["Type", details.fund.type ?? "—"], ["Currency", details.fund.currency ?? "—"], ["Market cap", details.fund.market_cap ? `$${Number(details.fund.market_cap).toLocaleString()}` : "—"], ["Symbol", details.fund.symbol ?? symbol]].map(([key, value]) => (
                                            <div key={key} className="rounded-[9px] border border-zinc-100 px-2.5 py-2">
                                                <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">{key}</div>
                                                <div className="mt-[3px] font-mono text-[13.5px] font-semibold">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-2 text-xs text-zinc-400">No fundamentals available</div>
                                )}
                                {details.fund?.description && (
                                    <div className="mt-2.5 rounded-[9px] border border-zinc-100 px-3 py-2 text-[12px] leading-relaxed text-zinc-700">
                                        {details.fund.description}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {tab === "news" && <CryptoNewsList news={details.news} loading={details.newsLoading} error={details.newsError} />}

                    {tab === "chart" && <CryptoChartPanel candles={details.candles} loading={details.loading} fxRate={fxRate} />}
                </div>

                {details.error && <div className="px-4 pb-2 text-[11px] text-red-800">{details.error}</div>}

                <div className="shrink-0 px-3.5 pb-3.5 pt-2.5" data-nodrag="1">
                    <div className="flex gap-2">
                        <Button onClick={onBuy} className="w-1/2 rounded-[9px] py-[9px] text-[13px]">
                            Buy {symbol}
                        </Button>
                        <Button onClick={onSell} variant="outline" className="w-1/2 rounded-[9px] py-[9px] text-[13px]">
                            Sell {symbol}
                        </Button>
                    </div>
                </div>
            </div>
        </CardFrame>
    );
}