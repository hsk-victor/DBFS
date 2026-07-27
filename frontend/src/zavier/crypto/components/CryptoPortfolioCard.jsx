import { CardFrame } from "@/victor/stocks/components/canvas/CardFrame";
import { fmtPct, fmtQty, fmtSgd, fmtUsd } from "@/shared/lib/format";

export function CryptoPortfolioCard({ card, holdings, fxRate, zoom, loading, onFront, onPatch, onRemove }) {
    const totalUsd = holdings.reduce((sum, row) => sum + Number(row?.value_usd ?? 0), 0);
    const costUsd = holdings.reduce((sum, row) => sum + Number(row?.qty ?? 0) * Number(row?.avg_price ?? 0), 0);
    const dayUsd = holdings.reduce((sum, row) => {
        const valueUsd = Number(row?.value_usd ?? 0);
        const changePct = Number(row?.change_pct ?? 0);
        return sum + (valueUsd * changePct) / 100;
    }, 0);
    const retUsd = totalUsd - costUsd;
    const dayUp = dayUsd >= 0;

    const header = (
        <>
            <div className="flex items-center gap-2.5 pr-14">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-zinc-900 bg-white font-mono text-[11px] font-semibold text-zinc-900">
                    CP
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tracking-tight">Crypto Portfolio</div>
                    <div className="truncate text-xs text-zinc-500">
                        {holdings.length} holding{holdings.length === 1 ? "" : "s"} · marked to market
                    </div>
                </div>
            </div>
            {loading ? (
                <div className="mt-3">
                    <div className="anim-pulse h-[26px] w-40 rounded-[7px] bg-zinc-100" />
                    <div className="anim-pulse mt-2 h-3 w-52 rounded-[5px] bg-zinc-100" />
                </div>
            ) : (
                <>
                    <div className="mt-3 flex items-baseline gap-2">
                        <div className="font-mono text-[26px] font-bold tracking-tight">{fmtSgd(totalUsd * fxRate)}</div>
                        <div
                            className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold"
                            style={{ color: dayUp ? "#166534" : "#991b1b", background: dayUp ? "#dcfce7" : "#fee2e2" }}
                        >
                            {dayUp ? "+" : "−"}S${Math.abs(dayUsd * fxRate).toFixed(2)} today
                        </div>
                    </div>
                    <div className="mt-[3px] font-mono text-[11.5px] text-zinc-400">
                        {retUsd >= 0 ? "+" : "−"}S${Math.abs(retUsd * fxRate).toFixed(2)} all-time · cost {fmtSgd(costUsd * fxRate)}
                    </div>
                </>
            )}
        </>
    );

    return (
        <CardFrame card={card} zoom={zoom} baseW={400} baseH={356} onFront={onFront} onPatch={onPatch} onRemove={onRemove} header={header}>
            <div className="min-h-0 flex-1 overflow-auto border-t border-zinc-100 px-4 pb-2.5 pt-1.5" data-nodrag="1">
                {holdings.map((row) => (
                    <div key={row.symbol} className="flex items-center gap-2.5 border-b border-zinc-100 py-[9px]">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 font-mono text-[10px] font-semibold text-white">
                            {row.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold">{row.symbol}</div>
                            <div className="font-mono text-[10.5px] text-zinc-400">
                                {fmtQty(Number(row.qty ?? 0))} units · avg {fmtUsd(Number(row.avg_price ?? 0))}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-[12.5px] font-semibold">{fmtSgd(Number(row.value_usd ?? 0) * fxRate)}</div>
                            <div className="font-mono text-[10.5px] font-semibold" style={{ color: Number(row.pl_pct ?? 0) >= 0 ? "#166534" : "#991b1b" }}>
                                {fmtPct(Number(row.pl_pct ?? 0))}
                            </div>
                        </div>
                    </div>
                ))}

                {!loading && holdings.length === 0 && (
                    <div className="py-[18px] text-center text-[12.5px] text-zinc-400">
                        No crypto holdings yet — buy a coin to get started
                    </div>
                )}
            </div>
        </CardFrame>
    );
}
