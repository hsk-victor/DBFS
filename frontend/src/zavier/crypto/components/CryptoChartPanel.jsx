import { Candles } from "@/victor/stocks/components/charts/Candles";

export function CryptoChartPanel({ candles, loading, fxRate }) {
    if (loading && !candles.length)
        return <div className="anim-pulse min-h-[170px] rounded bg-zinc-100" />;

    return (
        <div className="flex h-full min-h-[180px] flex-col">
            <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-zinc-400">EODHD historical candles</span>
                <span className="font-mono text-[10.5px] text-zinc-400">USD + SGD view</span>
            </div>
            <Candles candles={candles} fxRate={fxRate} />
        </div>
    );
}
