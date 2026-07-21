import { useState } from "react";
import { Canvas, loadView } from "@/victor/stocks/components/canvas/Canvas";
import { CryptoCard } from "@/zavier/crypto/components/CryptoCard";
import { CryptoBuyDialog } from "@/zavier/crypto/components/CryptoBuyDialog";
import { COINS } from "@/zavier/crypto/constants";
import { useCryptoDashboard } from "@/zavier/crypto/hooks/useCryptoDashboard";

export function CryptoPage() {
    const dashboard = useCryptoDashboard();
    const [view, setView] = useState(loadView);
    const [buyCoin, setBuyCoin] = useState(null);
    const [cards, setCards] = useState(() => [
        { sym: "BTC", x: 36, y: 36, w: 344, h: 400, z: 1, tab: "overview", big: false },
        { sym: "ETH", x: 412, y: 92, w: 344, h: 400, z: 2, tab: "overview", big: false },
        { sym: "XRP", x: 788, y: 36, w: 344, h: 400, z: 3, tab: "overview", big: false },
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

                {cards.map((card) => (
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
                        onBuy={() => setBuyCoin({
                            coin: COINS.find((item) => item.symbol === card.sym) ?? { symbol: card.sym, name: card.sym },
                            quote: dashboard.priceLookup[card.sym] ?? null,
                        })}
                    />
                ))}
            </Canvas>

            {buyCoin && (
                <CryptoBuyDialog
                    coin={buyCoin.coin}
                    quote={buyCoin.quote}
                    fxRate={dashboard.fx.rate}
                    onClose={() => setBuyCoin(null)}
                />
            )}
        </div>
    );
}
