import { useCallback, useEffect, useRef, useState } from "react";
function loadView() {
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    try {
        const z = parseFloat(localStorage.getItem("sdb-zoom-v1") ?? "");
        if (z >= 0.25 && z <= 2.5)
            zoom = z;
        const p = JSON.parse(localStorage.getItem("sdb-pan-v1") ?? "");
        if (p && isFinite(p.x) && isFinite(p.y))
            pan = p;
    }
    catch { /* defaults */ }
    return { zoom, pan };
}
/** Infinite pan/zoom canvas with a dotted grid — hosts the draggable cards. */
export function Canvas({ children, empty, view, setView, }) {
    const ref = useRef(null);
    const viewRef = useRef(view);
    viewRef.current = view;
    const [panning, setPanning] = useState(false);
    const save = useCallback((v) => {
        try {
            localStorage.setItem("sdb-zoom-v1", String(v.zoom));
            localStorage.setItem("sdb-pan-v1", JSON.stringify(v.pan));
        }
        catch { /* private mode */ }
    }, []);
    const zoomTo = useCallback((next, clientX, clientY) => {
        const el = ref.current;
        const { zoom, pan } = viewRef.current;
        const nz = Math.min(2.5, Math.max(0.25, next));
        if (!el || nz === zoom)
            return;
        const rect = el.getBoundingClientRect();
        const cx = (clientX === undefined ? rect.left + rect.width / 2 : clientX) - rect.left;
        const cy = (clientY === undefined ? rect.top + rect.height / 2 : clientY) - rect.top;
        const wx = (cx - pan.x) / zoom;
        const wy = (cy - pan.y) / zoom;
        const v = { zoom: nz, pan: { x: cx - wx * nz, y: cy - wy * nz } };
        setView(v);
        save(v);
    }, [setView, save]);
    // Wheel: zoom (shift+wheel pans)
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const onWheel = (e) => {
            e.preventDefault();
            if (!e.shiftKey) {
                zoomTo(viewRef.current.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
            }
            else {
                const { zoom, pan } = viewRef.current;
                const v = { zoom, pan: { x: pan.x - e.deltaX - (e.deltaX === 0 ? e.deltaY : 0), y: pan.y } };
                setView(v);
                save(v);
            }
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomTo, setView, save]);
    const onPointerDown = (e) => {
        if (e.button !== 0)
            return;
        if (e.target.closest("[data-card]"))
            return;
        e.preventDefault();
        const start = { sx: e.clientX, sy: e.clientY, ...viewRef.current.pan };
        setPanning(true);
        const mv = (ev) => {
            const v = {
                zoom: viewRef.current.zoom,
                pan: { x: start.x + ev.clientX - start.sx, y: start.y + ev.clientY - start.sy },
            };
            setView(v);
            save(v);
        };
        const up = () => {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            setPanning(false);
        };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
    };
    const { zoom, pan } = view;
    return (<div className="relative flex-1 overflow-hidden">
      <div ref={ref} onPointerDown={onPointerDown} className="canvas-grid absolute inset-0 touch-none overflow-hidden" style={{
            cursor: panning ? "grabbing" : "default",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}>
        <div className="absolute left-0 top-0 h-0 w-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      </div>

      {empty}

      <div className="pointer-events-none absolute bottom-4 left-5 flex items-center gap-3 font-mono text-[11px] text-zinc-400">
        <span>drag canvas to pan · scroll to zoom · shift + scroll to pan</span>
      </div>

      <div className="absolute bottom-3.5 right-4 flex items-center gap-0.5 rounded-[9px] border border-zinc-200 bg-white p-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <button onClick={() => zoomTo(viewRef.current.zoom / 1.2)} title="Zoom out" className="h-[26px] w-7 cursor-pointer rounded-[7px] text-sm text-zinc-600 hover:bg-zinc-100">
          −
        </button>
        <button onClick={() => zoomTo(1)} title="Reset to 100%" className="h-[26px] min-w-12 cursor-pointer rounded-[7px] font-mono text-[11px] font-semibold hover:bg-zinc-100">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => zoomTo(viewRef.current.zoom * 1.2)} title="Zoom in" className="h-[26px] w-7 cursor-pointer rounded-[7px] text-sm text-zinc-600 hover:bg-zinc-100">
          +
        </button>
      </div>
    </div>);
}
export { loadView };
