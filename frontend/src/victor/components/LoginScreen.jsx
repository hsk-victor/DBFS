import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { api } from "@/shared/lib/api";

const AUTH_BASE = "/api/victor/auth";

export function VictorLoginScreen({ paypalConfigured, onDemoLogin }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setBusy(true);
    setError("");
    if (paypalConfigured) {
      window.location.href = `${AUTH_BASE}/login`;
      return;
    }
    try {
      onDemoLogin(await api.post(`${AUTH_BASE}/demo`));
    } catch {
      setError("Login failed - is the Flask backend running?");
      setBusy(false);
    }
  };

  return (<div className="canvas-grid anim-fade fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-50 [background-size:24px_24px]">
    <div className="w-[372px] rounded-[18px] border border-zinc-200 bg-white px-[30px] py-[34px] text-center shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-zinc-900 font-mono text-lg font-semibold text-white">S</div>
      <div className="text-lg font-semibold tracking-tight">Straits Digital Bank</div>
      <div className="mt-1 text-[12.5px] text-zinc-500">Stocks · AI research desk</div>
      <Button variant="paypal" disabled={busy} onClick={login} className="mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-[13.5px]">
        <span className="italic font-bold tracking-tight">P</span>
        <span>{busy ? "Connecting to PayPal..." : "Log in with PayPal"}</span>
      </Button>
      {error && <div className="mt-3 text-[11.5px] text-red-800">{error}</div>}
      <div className="mt-3.5 flex items-center justify-center gap-1.5 font-mono text-[10.5px] text-zinc-400">
        <span className="size-1.5 rounded-full bg-green-500" />
        <span>{paypalConfigured ? "Sandbox environment · no real funds move" : "Demo mode · PayPal keys not configured"}</span>
      </div>
      <div className="mt-[18px] border-t border-zinc-100 pt-3.5 font-mono text-[10px] leading-relaxed text-zinc-400">
        OAuth 2.0 · openidconnect/userinfo<br />
        Your PayPal profile is never shared with the AI layer
      </div>
    </div>
  </div>);
}
