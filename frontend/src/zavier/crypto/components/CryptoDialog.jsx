import { useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { fmtPct, fmtSgd, fmtUsd, SENT_BG, SENT_FG } from "@/shared/lib/format";
import { CryptoChartPanel } from "@/zavier/crypto/components/CryptoChartPanel";
import { CryptoNewsList } from "@/zavier/crypto/components/CryptoNewsList";
import { CryptoTabs } from "@/zavier/crypto/components/CryptoTabs";
import { TABS } from "@/zavier/crypto/constants";
import { useCryptoDetails } from "@/zavier/crypto/hooks/useCryptoDetails";

export function CryptoDialog({ coin, quote, fxRate, onClose }) {
    const symbol = coin?.symbol ?? "";
    const details = useCryptoDetails(symbol, coin);
    const price = quote?.price ?? 0;
    const up = (quote?.change_pct ?? 0) >= 0;

    const overviewMetrics = useMemo(() => ([
        ["Price · Finnhub", fmtUsd(quote?.price ?? 0)],
        ["24h change", fmtPct(quote?.change_pct ?? 0)],
        ["High", fmtUsd(quote?.high ?? 0)],
        ["Low", fmtUsd(quote?.low ?? 0)],
    ]), [quote]);

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogPopup className="w-[420px] max-w-[calc(100vw-24px)] p-[22px]">
                <div className="flex items-center gap-[11px]">
                    <div className="flex size-9 items-center justify-center rounded-[9px] bg-zinc-900 font-mono text-xs font-semibold text-white">
                        {symbol.slice(0, 2)}
                    </div>
                    <div>
                        <div className="text-[15px] font-semibold">{coin.name} · live quote</div>
                        <div className="text-xs text-zinc-500">Crypto dashboard popup · stock-style layout</div>
                    </div>
                </div>

                <div className="mt-3.5 flex items-baseline gap-2">
                    <div className="font-mono text-[28px] font-bold tracking-tight">{fmtSgd(price * fxRate)}</div>
                    <div
                        className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold"
                        style={{ color: up ? "#166534" : "#991b1b", background: up ? "#dcfce7" : "#fee2e2" }}
                    >
                        {fmtPct(quote?.change_pct ?? 0)}
                    </div>
                </div>
                <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
                    ≈ {fmtUsd(price)} USD{quote?.source !== "live" ? " · cached" : ""}
                </div>

                <div className="mt-3.5 border-t border-zinc-100 pt-3">
                    <CryptoTabs value={details.tab} tabs={TABS} onChange={details.setTab} />
                </div>

                <div className="mt-3 min-h-[240px] border-t border-zinc-100 pt-3">
                    {details.tab === "overview" && (
                        <>
                            {details.loading && !details.loadedSymbol ? (
                                <div className="space-y-2">
                                    <div className="anim-pulse h-4 w-3/4 rounded bg-zinc-100" />
                                    <div className="anim-pulse h-4 rounded bg-zinc-100" />
                                    <div className="anim-pulse h-4 w-5/6 rounded bg-zinc-100" />
                                </div>
                            ) : (
                                <>
                                    <div className="mt-0 rounded-[9px] border border-zinc-100 px-2.5 py-2">
                                        <div className="mb-2 font-mono text-[10.5px] text-zinc-400">Overview · 1M close history</div>
                                        <div className="rounded-[12px] border border-zinc-100 bg-zinc-50/70 p-2.5">
                                            <CryptoChartPanel candles={details.candles} loading={details.loading} fxRate={fxRate} />
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {overviewMetrics.map(([key, value]) => (
                                            <div key={key} className="rounded-[9px] border border-zinc-100 px-2.5 py-2">
                                                <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">{key}</div>
                                                <div className="mt-[3px] font-mono text-[13.5px] font-semibold">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2.5 border-t border-dashed border-zinc-200 pt-2 text-[10.5px] text-zinc-400">
                                        GNews headlines + EODHD history + fundamentals cards
                                    </div>
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
                        </>
                    )}

                    {details.tab === "news" && <CryptoNewsList news={details.news} loading={details.newsLoading} error={details.newsError} />}

                    {details.tab === "chart" && <CryptoChartPanel candles={details.candles} loading={details.loading} fxRate={fxRate} />}

                </div>

                {details.error && <div className="mt-2 text-center text-[11.5px] text-red-800">{details.error}</div>}

                <div className="mt-4 flex items-center justify-end">
                    <Button onClick={onClose} className="rounded-[10px] px-4 py-[10px] text-[13px]">
                        Close
                    </Button>
                </div>
            </DialogPopup>
        </Dialog>
    );
}
