import { useCallback, useEffect, useRef, useState } from "react";

function loadView() {
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  try {
    const savedZoom = parseFloat(localStorage.getItem("sdb-crypto-zoom-v1") ?? "");
    if (savedZoom >= 0.25 && savedZoom <= 2.5) zoom = savedZoom;
    const savedPan = JSON.parse(localStorage.getItem("sdb-crypto-pan-v1") ?? "");
    if (savedPan && isFinite(savedPan.x) && isFinite(savedPan.y)) pan = savedPan;
  } catch {
    // Use the default view when browser storage is unavailable.
  }
  return { zoom, pan };
}

export function Canvas({ children, empty, view, setView }) {
  const ref = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [panning, setPanning] = useState(false);

  const save = useCallback((nextView) => {
    try {
      localStorage.setItem("sdb-crypto-zoom-v1", String(nextView.zoom));
      localStorage.setItem("sdb-crypto-pan-v1", JSON.stringify(nextView.pan));
    } catch {
      // Browser storage is optional.
    }
  }, []);

  const zoomTo = useCallback((next, clientX, clientY) => {
    const element = ref.current;
    const { zoom, pan } = viewRef.current;
    const nextZoom = Math.min(2.5, Math.max(0.25, next));
    if (!element || nextZoom === zoom) return;
    const rect = element.getBoundingClientRect();
    const centerX = (clientX === undefined ? rect.left + rect.width / 2 : clientX) - rect.left;
    const centerY = (clientY === undefined ? rect.top + rect.height / 2 : clientY) - rect.top;
    const worldX = (centerX - pan.x) / zoom;
    const worldY = (centerY - pan.y) / zoom;
    const nextView = { zoom: nextZoom, pan: { x: centerX - worldX * nextZoom, y: centerY - worldY * nextZoom } };
    setView(nextView);
    save(nextView);
  }, [save, setView]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      if (!event.shiftKey) {
        zoomTo(viewRef.current.zoom * Math.exp(-event.deltaY * 0.0022), event.clientX, event.clientY);
      } else {
        const { zoom, pan } = viewRef.current;
        const nextView = { zoom, pan: { x: pan.x - event.deltaX - (event.deltaX === 0 ? event.deltaY : 0), y: pan.y } };
        setView(nextView);
        save(nextView);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [save, setView, zoomTo]);

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest("[data-card]")) return;
    event.preventDefault();
    const start = { sx: event.clientX, sy: event.clientY, ...viewRef.current.pan };
    setPanning(true);
    const move = (nextEvent) => {
      const nextView = { zoom: viewRef.current.zoom, pan: { x: start.x + nextEvent.clientX - start.sx, y: start.y + nextEvent.clientY - start.sy } };
      setView(nextView);
      save(nextView);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPanning(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const { zoom, pan } = view;
  return (<div className="relative flex-1 overflow-hidden">
    <div ref={ref} onPointerDown={onPointerDown} className="canvas-grid absolute inset-0 touch-none overflow-hidden" style={{ cursor: panning ? "grabbing" : "default", backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}>
      <div className="absolute left-0 top-0 h-0 w-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
    {empty}
    <div className="pointer-events-none absolute bottom-4 left-5 flex items-center gap-3 font-mono text-[11px] text-zinc-400"><span>drag canvas to pan · scroll to zoom · shift + scroll to pan</span></div>
    <div className="absolute bottom-3.5 right-4 flex items-center gap-0.5 rounded-[9px] border border-zinc-200 bg-white p-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <button onClick={() => zoomTo(viewRef.current.zoom / 1.2)} title="Zoom out" className="h-[26px] w-7 cursor-pointer rounded-[7px] text-sm text-zinc-600 hover:bg-zinc-100">−</button>
      <button onClick={() => zoomTo(1)} title="Reset to 100%" className="h-[26px] min-w-12 cursor-pointer rounded-[7px] font-mono text-[11px] font-semibold hover:bg-zinc-100">{Math.round(zoom * 100)}%</button>
      <button onClick={() => zoomTo(viewRef.current.zoom * 1.2)} title="Zoom in" className="h-[26px] w-7 cursor-pointer rounded-[7px] text-sm text-zinc-600 hover:bg-zinc-100">+</button>
    </div>
  </div>);
}

export { loadView };
