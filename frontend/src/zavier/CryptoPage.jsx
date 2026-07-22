import { useEffect, useState } from "react";
import { Canvas, loadView } from "@/victor/stocks/components/canvas/Canvas";
import { CryptoCard } from "@/zavier/crypto/components/CryptoCard";
import { CryptoBuyDialog } from "@/zavier/crypto/components/CryptoBuyDialog";
import { CryptoPortfolioCard } from "@/zavier/crypto/components/CryptoPortfolioCard";
import { CryptoOrderResultDialog } from "@/zavier/crypto/components/CryptoOrderResultDialog";
import { COINS } from "@/zavier/crypto/constants";
import { useCryptoDashboard } from "@/zavier/crypto/hooks/useCryptoDashboard";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";
import { ZAVIER_CRYPTO_ADD_EVENT, ZAVIER_CRYPTO_REFRESH_EVENT } from "@/zavier/crypto/lib/topbarRefresh";

export function CryptoPage() {
    const [view, setView] = useState(loadView);
    const [tradeCoin, setTradeCoin] = useState(null);
    const [orderResult, setOrderResult] = useState(null);
    const [cards, setCards] = useState(() => [
        { sym: "BTC", x: 36, y: 36, w: 344, h: 400, z: 1, tab: "overview", big: false },
        { sym: "ETH", x: 412, y: 92, w: 344, h: 400, z: 2, tab: "overview", big: false },
        { sym: "XRP", x: 788, y: 36, w: 344, h: 400, z: 3, tab: "overview", big: false },
        { sym: "__CPF", x: 36, y: 470, w: 400, h: 356, z: 5, tab: "overview", big: false },
    ]);
    const activeSymbols = cards.filter((card) => card.sym !== "__CPF").map((card) => card.sym);
    const dashboard = useCryptoDashboard(activeSymbols);
    const showLoadingOverlay = dashboard.loading || dashboard.refreshing;

    const patchCard = (sym, patch) => {
        setCards((prev) => prev.map((card) => (card.sym === sym ? { ...card, ...patch } : card)));
    };

    const bringFront = (sym) => {
        setCards((prev) => {
            const top = Math.max(10, ...prev.map((card) => card.z)) + 1;
            return prev.map((card) => (card.sym === sym ? { ...card, z: top } : card));
        });
    };

    const removeCard = (sym) => {
        setCards((prev) => prev.filter((card) => card.sym !== sym));
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get("crypto_order_status");
        const orderId = params.get("crypto_order_id");
        if (!status || !orderId)
            return;

        let alive = true;
        cryptoApi.orderStatus(orderId)
            .then((payload) => {
                if (!alive)
                    return;
                setOrderResult({ status, order: payload.order ?? null, paypal: payload.paypal ?? null });
            })
            .catch(() => {
                if (!alive)
                    return;
                setOrderResult({ status, order: { order_id: orderId, status }, paypal: null });
            })
            .finally(() => {
                const next = new URL(window.location.href);
                next.searchParams.delete("crypto_order_status");
                next.searchParams.delete("crypto_order_id");
                window.history.replaceState({}, "", next.pathname + next.search);
            });

        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        const onTopbarRefresh = () => {
            dashboard.refresh();
        };
        window.addEventListener(ZAVIER_CRYPTO_REFRESH_EVENT, onTopbarRefresh);
        return () => window.removeEventListener(ZAVIER_CRYPTO_REFRESH_EVENT, onTopbarRefresh);
    }, [dashboard]);

    useEffect(() => {
        const onTopbarAdd = (event) => {
            const symbol = String(event?.detail?.symbol || "").toUpperCase().trim();
            if (!symbol)
                return;
            if (!COINS.find((coin) => coin.symbol === symbol))
                return;

            setCards((previous) => {
                const top = Math.max(10, ...previous.map((card) => card.z)) + 1;
                const existing = previous.find((card) => card.sym === symbol);
                if (existing)
                    return previous.map((card) => card.sym === symbol ? { ...card, z: top } : card);

                const n = previous.length;
                const bx = Math.round((60 - view.pan.x) / view.zoom + (n % 4) * 40);
                const by = Math.round((60 - view.pan.y) / view.zoom + (n % 4) * 40);
                return [...previous, { sym: symbol, x: bx, y: by, w: 344, h: 400, z: top, tab: "overview", big: false }];
            });
        };

        window.addEventListener(ZAVIER_CRYPTO_ADD_EVENT, onTopbarAdd);
        return () => window.removeEventListener(ZAVIER_CRYPTO_ADD_EVENT, onTopbarAdd);
    }, [view.pan.x, view.pan.y, view.zoom]);

    return (
        <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50">
            <Canvas
                view={view}
                setView={setView}
                empty={showLoadingOverlay ? (
                    <div className="pointer-events-none absolute inset-0 z-[550] flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-mono text-[11px] text-zinc-500 shadow-[0_6px_20px_rgba(0,0,0,0.05)]">
                            <span className="size-1.5 rounded-full bg-zinc-400 anim-pulse" />
                            <span>{dashboard.loading ? "Loading crypto market..." : "Refreshing crypto market..."}</span>
                        </div>
                    </div>
                ) : null}
            >
                {dashboard.error && (
                    <div className="absolute left-4 top-4 z-[600] rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                        {dashboard.error}
                    </div>
                )}

                {cards.map((card) => {
                    if (card.sym === "__CPF") {
                        return (
                            <CryptoPortfolioCard
                                key={card.sym}
                                card={card}
                                holdings={dashboard.holdings}
                                fxRate={dashboard.fx.rate}
                                zoom={view.zoom}
                                loading={dashboard.loading}
                                onFront={() => bringFront(card.sym)}
                                onPatch={(patch) => patchCard(card.sym, patch)}
                                onRemove={() => removeCard(card.sym)}
                            />
                        );
                    }
                    return (
                        <CryptoCard
                            key={card.sym}
                            card={card}
                            coin={COINS.find((coin) => coin.symbol === card.sym)}
                            quote={dashboard.priceLookup[card.sym]}
                            fxRate={dashboard.fx.rate}
                            zoom={view.zoom}
                            loading={dashboard.loading}
                            onFront={() => bringFront(card.sym)}
                            onPatch={(patch) => patchCard(card.sym, patch)}
                            onRemove={() => removeCard(card.sym)}
                            onBuy={() => setTradeCoin({
                                coin: {
                                    ...(COINS.find((item) => item.symbol === card.sym) ?? { symbol: card.sym, name: card.sym }),
                                    side: "buy",
                                },
                                quote: dashboard.priceLookup[card.sym] ?? null,
                            })}
                            onSell={() => {
                                const holding = (dashboard.holdings || []).find((row) => row.symbol === card.sym);
                                setTradeCoin({
                                    coin: {
                                        ...(COINS.find((item) => item.symbol === card.sym) ?? { symbol: card.sym, name: card.sym }),
                                        side: "sell",
                                        maxQty: Number(holding?.qty ?? 0),
                                    },
                                    quote: dashboard.priceLookup[card.sym] ?? null,
                                });
                            }}
                        />
                    );
                })}
            </Canvas>

            {tradeCoin && (
                <CryptoBuyDialog
                    coin={tradeCoin.coin}
                    quote={tradeCoin.quote}
                    fxRate={dashboard.fx.rate}
                    onClose={() => setTradeCoin(null)}
                    onSuccess={(payload) => {
                        setTradeCoin(null);
                        setOrderResult({ status: payload?.order?.status ?? "filled", order: payload?.order ?? null, paypal: payload?.paypal ?? null });
                        dashboard.refresh();
                    }}
                />
            )}

            {orderResult && <CryptoOrderResultDialog result={orderResult} onClose={() => {
                setOrderResult(null);
                dashboard.refresh();
            }} />}
        </div>
    );
}
