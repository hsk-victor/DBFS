import { useState } from "react";
import { fmtSgd, fmtUsd } from "@/shared/lib/format";

function formatDate(value) {
    const date = typeof value === "number"
        ? new Date(value * 1000)
        : new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime()))
        return String(value ?? "");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sparkline({ candles, up, fxRate }) {
    const [hovered, setHovered] = useState(null);
    const data = candles.slice(-18);
    if (!data.length)
        return <div className="mt-2.5 h-8" />;
    const closes = data.map((candle) => candle.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const active = hovered === null ? null : data[hovered];
    const tooltipTransform = hovered === 0
        ? "translateX(0)"
        : hovered === data.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
    return (<div
        data-nodrag="1"
        className="relative mt-2.5 flex h-8 items-end gap-0.5"
        onPointerLeave={() => setHovered(null)}
    >
        {active && (<div
            className="pointer-events-none absolute bottom-[calc(100%+4px)] z-20 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 font-mono text-[9.5px] text-white shadow-lg"
            style={{ left: `${((hovered + 0.5) / data.length) * 100}%`, transform: tooltipTransform }}
        >
            {formatDate(active.t)} · {fmtUsd(active.c)} · {fmtSgd(active.c * fxRate)}
        </div>)}
        {data.map((candle, index) => (<button
            key={`${candle.t}-${index}`}
            type="button"
            aria-label={`${formatDate(candle.t)}, close ${fmtUsd(candle.c)}`}
            onPointerEnter={() => setHovered(index)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            className="flex h-full flex-1 cursor-crosshair items-end border-0 bg-transparent p-0 outline-none"
        >
            <span className="block w-full rounded-[1px] transition-opacity" style={{
                height: `${Math.round(15 + ((candle.c - min) / span) * 85)}%`,
                background: up ? "#bbf7d0" : "#fecaca",
                opacity: hovered === null || hovered === index ? 1 : 0.45,
            }} />
        </button>))}
    </div>);
}