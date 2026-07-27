import { useState } from "react";
import { fmtSgd, fmtUsd } from "@/shared/lib/format";

function formatTimestamp(value) {
    const date = typeof value === "number"
        ? new Date(value * 1000)
        : new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime()))
        return String(value ?? "");
    const hasTime = typeof value === "string" && String(value).length > 10;
    return date.toLocaleString(undefined, hasTime
        ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
        : { month: "short", day: "numeric", year: "numeric" });
}

export function Candles({ candles, fxRate }) {
    const [hovered, setHovered] = useState(null);
    if (!candles.length) {
        return (<div className="flex min-h-[70px] flex-1 items-center justify-center text-xs text-zinc-400">
            No chart data
        </div>);
    }
    const data = candles.slice(-40);
    const hi = Math.max(...data.map((c) => c.h));
    const lo = Math.min(...data.map((c) => c.l));
    const span = hi - lo || 1;
    const pct = (value) => ((hi - value) / span) * 100;
    const n = data.length;
    const slot = 100 / n;
    const active = hovered === null ? null : data[hovered];
    const activeMove = active ? ((active.c / active.o) - 1) * 100 : 0;
    return (<div
        className="relative min-h-[90px] flex-1 cursor-crosshair overflow-hidden rounded-md bg-zinc-50/60"
        onPointerLeave={() => setHovered(null)}
    >
        {[25, 50, 75].map((position) => (<div
            key={position}
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-zinc-200/80"
            style={{ top: `${position}%` }}
        />))}
        <span className="pointer-events-none absolute right-1 top-0 z-10 font-mono text-[8.5px] text-zinc-400">{fmtUsd(hi)}</span>
        <span className="pointer-events-none absolute bottom-0 right-1 z-10 font-mono text-[8.5px] text-zinc-400">{fmtUsd(lo)}</span>

        {data.map((candle, index) => {
            const upBar = candle.c >= candle.o;
            const top = pct(Math.max(candle.o, candle.c));
            const bodyHeight = Math.max(2, Math.abs(pct(candle.o) - pct(candle.c)));
            const dimmed = hovered !== null && hovered !== index;
            return (<div key={`${candle.t}-${index}`} className={dimmed ? "opacity-40" : "opacity-100"}>
                <div className="pointer-events-none absolute w-[2px] bg-zinc-300" style={{
                    left: `calc(${(index * slot).toFixed(2)}% + ${slot / 2}% - 1px)`,
                    top: `${pct(candle.h).toFixed(1)}%`,
                    height: `${(pct(candle.l) - pct(candle.h)).toFixed(1)}%`,
                }} />
                <div className="pointer-events-none absolute rounded-[1px]" style={{
                    left: `${(index * slot + slot * 0.15).toFixed(2)}%`,
                    width: `${(slot * 0.7).toFixed(2)}%`,
                    top: `${top.toFixed(1)}%`,
                    height: `${bodyHeight.toFixed(1)}%`,
                    background: upBar ? "#22c55e" : "#ef4444",
                }} />
            </div>);
        })}

        {active && (<>
            <div className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-zinc-500/60" style={{ left: `${(hovered + 0.5) * slot}%` }} />
            <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-zinc-500/60" style={{ top: `${pct(active.c)}%` }} />
            <div className={`pointer-events-none absolute top-1 z-20 rounded-lg bg-zinc-900 px-2.5 py-2 font-mono text-[9.5px] leading-relaxed text-white shadow-lg ${hovered < n / 2 ? "right-1" : "left-1"}`}>
                <div className="mb-1 text-zinc-300">{formatTimestamp(active.t)}</div>
                <div className="grid grid-cols-4 gap-x-2">
                    <span className="text-zinc-400">O</span><span>{fmtUsd(active.o)}</span>
                    <span className="text-zinc-400">H</span><span>{fmtUsd(active.h)}</span>
                    <span className="text-zinc-400">L</span><span>{fmtUsd(active.l)}</span>
                    <span className="text-zinc-400">C</span><span>{fmtUsd(active.c)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3 border-t border-zinc-700 pt-1">
                    <span style={{ color: activeMove >= 0 ? "#86efac" : "#fca5a5" }}>
                        {activeMove >= 0 ? "+" : ""}{activeMove.toFixed(2)}%
                    </span>
                    <span className="text-zinc-300">{fmtSgd(active.c * fxRate)}</span>
                </div>
            </div>
        </>)}

        {data.map((candle, index) => (<button
            key={`hit-${candle.t}-${index}`}
            type="button"
            aria-label={`${formatTimestamp(candle.t)}, open ${fmtUsd(candle.o)}, high ${fmtUsd(candle.h)}, low ${fmtUsd(candle.l)}, close ${fmtUsd(candle.c)}`}
            onPointerEnter={() => setHovered(index)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            className="absolute bottom-0 top-0 z-30 border-0 bg-transparent p-0 outline-none"
            style={{ left: `${index * slot}%`, width: `${slot}%` }}
        />))}
    </div>);
}