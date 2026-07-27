import { Button } from "@/shared/components/ui/button";

export function CryptoHeader({ fx, refreshing, onRefresh }) {
    return (
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
            <div>
                <div className="text-[15px] font-semibold tracking-tight">Crypto</div>
                <div className="font-mono text-[11px] text-zinc-400">
                    BTC · ETH · XRP · live quotes, candles, fundamentals and news
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-[5px] font-mono text-[11.5px] text-zinc-500">
                    1 USD = S${fx.rate.toFixed(4)} · {fx.source === "demo" ? "fixed" : "ECB"}
                </div>
                <Button variant="outline" onClick={onRefresh} disabled={refreshing} className="px-3.5 py-[7px] text-[12px]">
                    {refreshing ? "Refreshing…" : "Refresh"}
                </Button>
            </div>
        </div>
    );
}
