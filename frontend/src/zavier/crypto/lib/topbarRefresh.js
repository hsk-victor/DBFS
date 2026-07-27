export const ZAVIER_CRYPTO_REFRESH_EVENT = "zavier:crypto:refresh";
export const ZAVIER_CRYPTO_ADD_EVENT = "zavier:crypto:add";

export function requestCryptoRefresh() {
    window.dispatchEvent(new CustomEvent(ZAVIER_CRYPTO_REFRESH_EVENT));
}

export function requestCryptoAddSymbol(symbol) {
    const sym = String(symbol || "").toUpperCase().trim();
    if (!sym)
        return;
    window.dispatchEvent(new CustomEvent(ZAVIER_CRYPTO_ADD_EVENT, {
        detail: { symbol: sym },
    }));
}
