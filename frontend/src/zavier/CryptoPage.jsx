import { useEffect, useState } from "react";
import { Canvas, loadView } from "@/victor/stocks/components/canvas/Canvas";
import { CryptoCard } from "@/zavier/crypto/components/CryptoCard";
import { CryptoBuyDialog } from "@/zavier/crypto/components/CryptoBuyDialog";
import { CryptoPortfolioCard } from "@/zavier/crypto/components/CryptoPortfolioCard";
import { CryptoOrderResultDialog } from "@/zavier/crypto/components/CryptoOrderResultDialog";
import { COINS } from "@/zavier/crypto/constants";
import { useCryptoDashboard } from "@/zavier/crypto/hooks/useCryptoDashboard";
import { cryptoApi } from "@/zavier/crypto/lib/cryptoApi";

export function CryptoPage() {
    const dashboard = useCryptoDashboard();
    const [view, setView] = useState(loadView);
    const [tradeCoin, setTradeCoin] = useState(null);
    const [orderResult, setOrderResult] = useState(null);
    const [cards, setCards] = useState(() => [
        { sym: "BTC", x: 36, y: 36, w: 344, h: 400, z: 1, tab: "overview", big: false },
        { sym: "ETH", x: 412, y: 92, w: 344, h: 400, z: 2, tab: "overview", big: false },
        { sym: "XRP", x: 788, y: 36, w: 344, h: 400, z: 3, tab: "overview", big: false },
        { sym: "__CPF", x: 36, y: 470, w: 400, h: 356, z: 5, tab: "overview", big: false },
    ]);

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

    return (
        <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50">
            <Canvas
                view={view}
                setView={setView}
                empty={dashboard.loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="text-sm text-zinc-500">Loading crypto watchlist</div>
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
