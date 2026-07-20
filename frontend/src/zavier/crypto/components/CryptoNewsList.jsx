import { formatWhen } from "@/zavier/crypto/lib/cryptoFormat";

function SentBadge({ tag }) {
    const bg = tag === "Bullish" ? "#dcfce7" : tag === "Bearish" ? "#fee2e2" : "#f4f4f5";
    const fg = tag === "Bullish" ? "#166534" : tag === "Bearish" ? "#991b1b" : "#52525b";
    return <span className="rounded-full px-2 py-[3px] font-semibold uppercase tracking-wider text-[10px]" style={{ background: bg, color: fg }}>{tag}</span>;
}

export function CryptoNewsList({ news, loading, error }) {
    if (loading && !news)
        return (
            <div className="space-y-2">
                <div className="anim-pulse h-10 rounded bg-zinc-100" />
                <div className="anim-pulse h-10 rounded bg-zinc-100" />
            </div>
        );

    if (error)
        return (
            <div className="rounded-[9px] border border-red-200 bg-red-50 px-2.5 py-2 text-[11.5px] text-red-800">
                <div className="font-semibold">News request failed</div>
                <div className="mt-1 font-mono text-[10.5px]">{error}</div>
            </div>
        );

    if (!news?.length)
        return <div className="py-4 text-center text-xs text-zinc-400">No recent headlines</div>;

    return (
        <>
            {news.slice(0, 5).map((item, index) => (
                <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 border-b border-zinc-100 py-[7px] no-underline"
                >
                    <span className="mt-[1px] shrink-0">
                        <SentBadge tag={index % 3 === 0 ? "Bullish" : index % 3 === 1 ? "Neutral" : "Bearish"} />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium leading-snug text-zinc-900">{item.title}</span>
                        <span className="mt-0.5 block font-mono text-[10.5px] text-zinc-400">
                            {item.source} · {formatWhen(item.published_at)}
                        </span>
                    </span>
                </a>
            ))}
        </>
    );
}
