import { useCallback, useEffect, useState } from "react";
import { ZavierLoginScreen } from "@/zavier/components/LoginScreen";
import { ZavierTopBar } from "@/zavier/components/TopBar";
import { CryptoPage } from "@/zavier/CryptoPage";
import { COINS } from "@/zavier/crypto/constants";
import { requestCryptoAddSymbol, requestCryptoRefresh } from "@/zavier/crypto/lib/topbarRefresh";
import { api } from "@/shared/lib/api";

const AUTH_BASE = "/api/zavier/auth";

export function ZavierApp({ onNavigate }) {
  const [me, setMe] = useState(null);
  const [fx, setFx] = useState({ rate: 1.2748, source: "demo", provider: "fixed fallback" });
  const [refreshing, setRefreshing] = useState(false);
  const authed = !!me?.authenticated;

  const refreshFx = useCallback(async () => {
    try {
      const payload = await api.get("/api/crypto/fx");
      setFx({
        rate: Number(payload?.rate ?? 1.2748),
        source: String(payload?.source ?? "live"),
        provider: String(payload?.provider ?? "EODHD Forex"),
      });
    } catch {
      // Keep the last known FX value if the provider is unavailable.
    }
  }, []);

  useEffect(() => {
    api.get(`${AUTH_BASE}/me`).then(setMe).catch(() => setMe({ authenticated: false, paypal_configured: false }));
  }, []);

  useEffect(() => {
    if (authed) refreshFx();
  }, [authed, refreshFx]);

  const logout = useCallback(async () => {
    await api.post(`${AUTH_BASE}/logout`).catch(() => {});
    setMe((current) => current ? { ...current, authenticated: false, user: undefined } : current);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    requestCryptoRefresh();
    await refreshFx();
    window.setTimeout(() => setRefreshing(false), 350);
  }, [refreshFx]);

  if (!me) {
    return <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-400">Connecting...</div>;
  }
  if (!authed || !me.user) {
    return <ZavierLoginScreen paypalConfigured={me.paypal_configured} onDemoLogin={(user) => setMe({ authenticated: true, paypal_configured: me.paypal_configured, user })} />;
  }

  return (<div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
    <ZavierTopBar
      user={me.user}
      onNavigate={onNavigate}
      fx={fx}
      refreshing={refreshing}
      coins={COINS}
      onAddSymbol={requestCryptoAddSymbol}
      onRefresh={refresh}
      onLogout={logout}
    />
    <CryptoPage />
  </div>);
}
