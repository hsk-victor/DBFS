import { Maximize2, X } from "lucide-react";

export function CardFrame({ card, zoom, onFront, onPatch, onRemove, header, children, baseW = 344, baseH = 400, }) {
    const startDrag = (mode) => (e) => {
        if (e.button !== 0)
            return;
        if (mode === "move" && e.target.closest("[data-nodrag]"))
            return;
        e.preventDefault();
        e.stopPropagation();
        onFront();
        const start = { sx: e.clientX, sy: e.clientY, x: card.x, y: card.y, w: card.w, h: card.h };
        const mv = (ev) => {
            const dx = (ev.clientX - start.sx) / zoom;
            const dy = (ev.clientY - start.sy) / zoom;
            if (mode === "move") {
                onPatch({ x: Math.round(start.x + dx), y: Math.round(start.y + dy) });
            }
            else {
                onPatch({
                    w: Math.min(680, Math.max(300, Math.round(start.w + dx))),
                    h: Math.min(760, Math.max(340, Math.round(start.h + dy))),
                });
            }
        };
        const up = () => {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
    };
    const toggleBig = () => onPatch(card.big ? { big: false, w: baseW, h: baseH } : { big: true, w: 480, h: 540 });

    return (<div data-card="1" onPointerDown={onFront} className="absolute flex flex-col overflow-hidden rounded-[14px] border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ left: card.x, top: card.y, width: card.w, height: card.h, zIndex: card.z }}>
        <div onPointerDown={startDrag("move")} className="relative shrink-0 cursor-grab touch-none select-none px-4 pb-3 pt-3.5">
            {header}
            <div className="absolute right-2 top-2.5 flex" data-nodrag="1">
                <button onClick={toggleBig} title="Expand" className="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
                    <Maximize2 className="size-3.5" />
                </button>
                <button onClick={onRemove} title="Remove" className="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
                    <X className="size-3.5" />
                </button>
            </div>
        </div>

        {children}

        <div onPointerDown={startDrag("resize")} title="Resize" className="absolute bottom-[3px] right-[3px] h-[15px] w-[15px] cursor-nwse-resize touch-none rounded-br-[11px] border-b-2 border-r-2 border-zinc-300" />
    </div>);
}