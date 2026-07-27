import { useCallback, useEffect, useState } from "react";
import { VictorLoginScreen } from "@/victor/components/LoginScreen";
import { VictorTopBar } from "@/victor/components/TopBar";
import { Canvas, loadView } from "@/victor/stocks/components/canvas/Canvas";
import { PortfolioCard } from "@/victor/stocks/components/canvas/PortfolioCard";
import { StockCard } from "@/victor/stocks/components/canvas/StockCard";
import { TradeDialog } from "@/victor/stocks/components/TradeDialog";
import { useDashboard } from "@/victor/stocks/hooks/useDashboard";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { api } from "@/shared/lib/api";

const AUTH_BASE = "/api/victor/auth";

function OrderReturnDialog({ status, orderId, onClose }) {
  const ok = status === "filled";
  return (<Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogPopup>
      <div className="px-0 pb-0.5 pt-2 text-center">
        <div className="mx-auto mb-3 flex size-[46px] items-center justify-center rounded-full text-xl" style={{
          background: ok ? "#dcfce7" : status === "cancelled" ? "#f4f4f5" : "#fee2e2",
          color: ok ? "#166534" : status === "cancelled" ? "#52525b" : "#991b1b",
        }}>{ok ? "✓" : status === "cancelled" ? "—" : "✕"}</div>
        <div className="text-base font-semibold">{ok ? "Order filled" : status === "cancelled" ? "Checkout cancelled" : "Payment failed"}</div>
        <div className="mt-1.5 text-[13px] text-zinc-500">
          {ok ? "Payment captured in SGD via PayPal Sandbox" : status === "cancelled" ? "No funds moved — the order was not placed" : "The PayPal capture did not complete — no shares were added"}
        </div>
        {orderId && <div className="mt-2 font-mono text-[11px] text-zinc-400">PayPal order {orderId} · sandbox</div>}
        <Button onClick={onClose} className="mt-[18px] w-full rounded-[10px] py-2.5 text-[13px]">Done</Button>
      </div>
    </DialogPopup>
  </Dialog>);
}

export function VictorApp({ onNavigate }) {
  const [me, setMe] = useState(null);
  const [view, setView] = useState(loadView);
  const [trade, setTrade] = useState(null);
  const [orderReturn, setOrderReturn] = useState(null);
  const authed = !!me?.authenticated;
  const dash = useDashboard(authed);

  useEffect(() => {
    api.get(`${AUTH_BASE}/me`).then(setMe).catch(() => setMe({ authenticated: false, paypal_configured: false }));
    const query = new URLSearchParams(window.location.search);
    const status = query.get("order_status");
    if (!status) return;
    setOrderReturn({ status, orderId: query.get("order_id") ?? "" });
    const next = new URL(window.location.href);
    next.searchParams.delete("order_status");
    next.searchParams.delete("order_id");
    window.history.replaceState({}, "", `${next.pathname}${next.search}`);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setTrade(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = useCallback(async () => {
    await api.post(`${AUTH_BASE}/logout`).catch(() => {});
    setMe((current) => current ? { ...current, authenticated: false, user: undefined } : current);
  }, []);

  if (!me) {
    return <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-400">Connecting...</div>;
  }
  if (!authed || !me.user) {
    return <VictorLoginScreen paypalConfigured={me.paypal_configured} onDemoLogin={(user) => setMe({ authenticated: true, paypal_configured: me.paypal_configured, user })} />;
  }

  const user = me.user;
  const layout = dash.layout ?? [];
  const onCanvas = new Set(layout.map((card) => card.sym));
  const portfolioCard = layout.find((card) => card.sym === "__PF");
  const stockCards = layout.filter((card) => card.sym !== "__PF");
  const nameOf = (symbol) => dash.symbols.find((item) => item.symbol === symbol)?.name ?? symbol;
  const ownedQty = (symbol) => dash.holdings.find((holding) => holding.symbol === symbol)?.qty ?? 0;
  const merchantNote = user.demo ? "Sandbox capture simulated (demo login)" : "Funds sent to the bank's PayPal merchant account";

  return (<div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
    <VictorTopBar
      user={user}
      onNavigate={onNavigate}
      fx={dash.fx}
      loading={dash.loading}
      refreshing={dash.refreshing}
      refreshError={dash.refreshError}
      lastUpdatedAt={dash.lastUpdatedAt}
      dataState={dash.dataState}
      addableSymbols={dash.symbols.filter((symbol) => !onCanvas.has(symbol.symbol))}
      portfolioOnCanvas={!!portfolioCard}
      onAddSymbol={(symbol) => dash.addCard(symbol, view.pan.x, view.pan.y, view.zoom)}
      onAddPortfolio={() => dash.addCard("__PF", view.pan.x, view.pan.y, view.zoom)}
      onRefresh={dash.refreshMarket}
      onLogout={logout}
    />
    <Canvas view={view} setView={setView} empty={layout.length === 0 && dash.layout !== null ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="text-sm text-zinc-500">Your watchlist is empty</div>
        <Button variant="outline" onClick={dash.resetLayout} className="px-4 py-2">Restore default watchlist</Button>
      </div>
    ) : null}>
      {stockCards.map((card) => (<StockCard
        key={card.sym}
        card={card}
        name={nameOf(card.sym)}
        quote={dash.quotes[card.sym]}
        fxRate={dash.fx.rate}
        zoom={view.zoom}
        loading={dash.loading}
        onFront={() => dash.bringFront(card.sym)}
        onPatch={(patch) => dash.patchCard(card.sym, patch)}
        onRemove={() => dash.removeCard(card.sym)}
        onBuy={() => setTrade({ sym: card.sym, side: "buy", name: nameOf(card.sym) })}
      />))}
      {portfolioCard && (<PortfolioCard
        card={portfolioCard}
        holdings={dash.holdings}
        orders={dash.orders}
        fxRate={dash.fx.rate}
        zoom={view.zoom}
        loading={dash.loading}
        onFront={() => dash.bringFront("__PF")}
        onPatch={(patch) => dash.patchCard("__PF", patch)}
        onRemove={() => dash.removeCard("__PF")}
        onSell={(symbol) => setTrade({ sym: symbol, side: "sell", name: nameOf(symbol) })}
        onCancelOrder={async (id) => {
          await api.post(`/api/orders/${id}/cancel`).catch(() => {});
          dash.refreshOrders();
        }}
      />)}
    </Canvas>
    {trade && (<TradeDialog
      trade={trade}
      quote={dash.quotes[trade.sym]}
      fxRate={dash.fx.rate}
      fxProvider={dash.fx.source === "demo" ? "fixed rate" : "Frankfurter (ECB)"}
      ownedQty={ownedQty(trade.sym)}
      userEmail={user.email}
      merchantNote={merchantNote}
      onClose={() => setTrade(null)}
      onComplete={() => {
        dash.refreshHoldings();
        dash.refreshOrders();
      }}
    />)}
    {orderReturn && (<OrderReturnDialog status={orderReturn.status} orderId={orderReturn.orderId} onClose={() => {
      setOrderReturn(null);
      dash.refreshHoldings();
      dash.refreshOrders();
    }} />)}
  </div>);
}
