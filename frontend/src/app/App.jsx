import { useCallback, useEffect, useState } from "react";
import { Canvas, loadView } from "@/victor/stocks/components/canvas/Canvas";
import { PortfolioCard } from "@/victor/stocks/components/canvas/PortfolioCard";
import { StockCard } from "@/victor/stocks/components/canvas/StockCard";
import { TradeDialog } from "@/victor/stocks/components/TradeDialog";
import { useDashboard } from "@/victor/stocks/hooks/useDashboard";
import { LoginScreen } from "@/shared/components/LoginScreen";
import { TopBar } from "@/shared/components/TopBar";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { api } from "@/shared/lib/api";
import { CryptoPage } from "@/zavier/CryptoPage";
import { OtherPage } from "@/ong_xuan/OtherPage";
/** Result banner after returning from a real PayPal checkout redirect. */
function OrderReturnDialog({ status, orderId, onClose }) {
  const ok = status === "filled";
  return (<Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogPopup>
      <div className="px-0 pb-0.5 pt-2 text-center">
        <div className="mx-auto mb-3 flex size-[46px] items-center justify-center rounded-full text-xl" style={{
          background: ok ? "#dcfce7" : status === "cancelled" ? "#f4f4f5" : "#fee2e2",
          color: ok ? "#166534" : status === "cancelled" ? "#52525b" : "#991b1b",
        }}>
          {ok ? "✓" : status === "cancelled" ? "—" : "✕"}
        </div>
        <div className="text-base font-semibold">
          {ok ? "Order filled" : status === "cancelled" ? "Checkout cancelled" : "Payment failed"}
        </div>
        <div className="mt-1.5 text-[13px] text-zinc-500">
          {ok ? "Payment captured in SGD via PayPal Sandbox" :
            status === "cancelled" ? "No funds moved — the order was not placed" :
              "The PayPal capture did not complete — no shares were added"}
        </div>
        {orderId && (<div className="mt-2 font-mono text-[11px] text-zinc-400">PayPal order {orderId} · sandbox</div>)}
        <Button onClick={onClose} className="mt-[18px] w-full rounded-[10px] py-2.5 text-[13px]">
          Done
        </Button>
      </div>
    </DialogPopup>
  </Dialog>);
}
export default function App() {
  const [me, setMe] = useState(null);
  const [section, setSection] = useState("Stocks");
  const [view, setView] = useState(loadView);
  const [trade, setTrade] = useState(null);
  const [orderReturn, setOrderReturn] = useState(null);
  const authed = !!me?.authenticated;
  const dash = useDashboard(authed);
  useEffect(() => {
    api.get("/api/auth/me").then(setMe).catch(() => setMe({ authenticated: false, paypal_configured: false }));
    // Coming back from a PayPal approval redirect?
    const q = new URLSearchParams(window.location.search);
    const status = q.get("order_status");
    if (status) {
      setOrderReturn({ status, orderId: q.get("order_id") ?? "" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  // Esc closes dialogs (Base UI handles its own, this covers the trade state)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape")
        setTrade(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => { });
    setMe((m) => (m ? { ...m, authenticated: false, user: undefined } : m));
  }, []);
  if (!me) {
    return (<div className="flex h-full items-center justify-center font-mono text-xs text-zinc-400">
      Connecting…
    </div>);
  }
  if (!authed || !me.user) {
    return (<LoginScreen paypalConfigured={me.paypal_configured} onDemoLogin={(u) => setMe({ authenticated: true, paypal_configured: me.paypal_configured, user: u })} />);
  }
  const user = me.user;
  const layout = dash.layout ?? [];
  const onCanvas = new Set(layout.map((c) => c.sym));
  const pfCard = layout.find((c) => c.sym === "__PF");
  const stockCards = layout.filter((c) => c.sym !== "__PF");
  const nameOf = (sym) => dash.symbols.find((s) => s.symbol === sym)?.name ?? sym;
  const ownedQty = (sym) => dash.holdings.find((h) => h.symbol === sym)?.qty ?? 0;
  const merchantNote = user.demo
    ? "Sandbox capture simulated (demo login)"
    : "Funds sent to the bank's PayPal merchant account";
  return (<div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
    <TopBar user={user} section={section} onSection={setSection} fx={dash.fx} loading={dash.loading} refreshing={dash.refreshing} refreshError={dash.refreshError} lastUpdatedAt={dash.lastUpdatedAt} dataState={dash.dataState} addableSymbols={dash.symbols.filter((s) => !onCanvas.has(s.symbol))} portfolioOnCanvas={!!pfCard} onAddSymbol={(sym) => dash.addCard(sym, view.pan.x, view.pan.y, view.zoom)} onAddPortfolio={() => dash.addCard("__PF", view.pan.x, view.pan.y, view.zoom)} onRefresh={dash.refreshMarket} onLogout={logout} />

    {section === "Stocks" ? (<Canvas view={view} setView={setView} empty={layout.length === 0 && dash.layout !== null ? (<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div className="text-sm text-zinc-500">Your watchlist is empty</div>
      <Button variant="outline" onClick={dash.resetLayout} className="px-4 py-2">
        Restore default watchlist
      </Button>
    </div>) : null}>
      {stockCards.map((card) => (<StockCard key={card.sym} card={card} name={nameOf(card.sym)} quote={dash.quotes[card.sym]} fxRate={dash.fx.rate} zoom={view.zoom} loading={dash.loading} onFront={() => dash.bringFront(card.sym)} onPatch={(p) => dash.patchCard(card.sym, p)} onRemove={() => dash.removeCard(card.sym)} onBuy={() => setTrade({ sym: card.sym, side: "buy", name: nameOf(card.sym) })} />))}
      {pfCard && (<PortfolioCard card={pfCard} holdings={dash.holdings} orders={dash.orders} fxRate={dash.fx.rate} zoom={view.zoom} loading={dash.loading} onFront={() => dash.bringFront("__PF")} onPatch={(p) => dash.patchCard("__PF", p)} onRemove={() => dash.removeCard("__PF")} onSell={(sym) => setTrade({ sym, side: "sell", name: nameOf(sym) })} onCancelOrder={async (id) => {
        await api.post(`/api/orders/${id}/cancel`).catch(() => { });
        dash.refreshOrders();
      }} />)}
    </Canvas>) : section === "Crypto" ? (<CryptoPage />) : (<OtherPage />)}

    {trade && (<TradeDialog trade={trade} quote={dash.quotes[trade.sym]} fxRate={dash.fx.rate} fxProvider={dash.fx.source === "demo" ? "fixed rate" : "Frankfurter (ECB)"} ownedQty={ownedQty(trade.sym)} userEmail={user.email} merchantNote={merchantNote} onClose={() => setTrade(null)} onComplete={() => {
      dash.refreshHoldings();
      dash.refreshOrders();
    }} />)}

    {orderReturn && (<OrderReturnDialog status={orderReturn.status} orderId={orderReturn.orderId} onClose={() => {
      setOrderReturn(null);
      dash.refreshHoldings();
      dash.refreshOrders();
    }} />)}
  </div>);
}
