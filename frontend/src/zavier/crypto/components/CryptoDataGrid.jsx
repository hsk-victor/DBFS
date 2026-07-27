export function CryptoDataGrid({ metrics, description, loading }) {
    if (loading && !metrics.length)
        return (
            <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="anim-pulse h-12 rounded-[9px] bg-zinc-100" />))}
            </div>
        );

    if (!metrics.length)
        return <div className="py-4 text-center text-xs text-zinc-400">No data available</div>;

    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                {metrics.map(([key, value]) => (
                    <div key={key} className="rounded-[9px] border border-zinc-100 px-2.5 py-2">
                        <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">{key}</div>
                        <div className="mt-[3px] font-mono text-[13.5px] font-semibold">{value}</div>
                    </div>
                ))}
            </div>
            {description && (
                <div className="mt-2.5 rounded-[9px] border border-zinc-100 px-3 py-2 text-[12px] leading-relaxed text-zinc-700">
                    {description}
                </div>
            )}
        </>
    );
}
