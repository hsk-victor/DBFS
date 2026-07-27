import { useCallback, useEffect, useState } from "react";
import { OngXuanLoginScreen } from "@/ong_xuan/components/LoginScreen";
import { OngXuanTopBar } from "@/ong_xuan/components/TopBar";
import { ForexPage } from "@/ong_xuan/ForexPage";
import { api } from "@/shared/lib/api";

const AUTH_BASE = "/api/ong-xuan/auth";

export function OngXuanApp({ onNavigate }) {
  const [me, setMe] = useState(null);
  const authed = !!me?.authenticated;

  useEffect(() => {
    api.get(`${AUTH_BASE}/me`).then(setMe).catch(() => setMe({ authenticated: false, paypal_configured: false }));
  }, []);

  const logout = useCallback(async () => {
    await api.post(`${AUTH_BASE}/logout`).catch(() => {});
    setMe((current) => current ? { ...current, authenticated: false, user: undefined } : current);
  }, []);

  if (!me) {
    return <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-400">Connecting...</div>;
  }
  if (!authed || !me.user) {
    return <OngXuanLoginScreen paypalConfigured={me.paypal_configured} onDemoLogin={(user) => setMe({ authenticated: true, paypal_configured: me.paypal_configured, user })} />;
  }

  return (<div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
    <OngXuanTopBar user={me.user} onNavigate={onNavigate} onLogout={logout} />
    <ForexPage />
  </div>);
}
