import { useEffect, useState } from "react";
import { ChevronDown, LogOut, RefreshCw, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/shared/components/ui/menu";
import { fmtPct, fmtUsd } from "@/shared/lib/format";
import { SECTIONS } from "@/shared/lib/navigation";

function profileValue(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function ProfileMenu({ user, onLogout }) {
  const name = String(user.name ?? "");
  const email = String(user.email ?? "");
  const initials = name.split(" ").map((word) => word[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "PP";
  const address = user.address || {};
  const accountStatus = user.verified ? "Verified" : "Unverified";
  const emailParts = email.split("@");
  const emailLabel = `${emailParts[0] || "paypal"}@${user.demo ? "sandbox" : emailParts[1] || ""}`;

  return (<div className="border-l border-zinc-200 pl-3.5">
    <Menu>
      <MenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100">
        <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600">{initials}</div>
        <div className="font-mono text-xs text-zinc-500">{emailLabel}</div>
        <ChevronDown className="size-3 text-zinc-400" />
      </MenuTrigger>
      <MenuPopup align="end" className="w-[340px]">
        <div className="flex items-center gap-[11px] border-b border-zinc-100 px-2.5 pb-3 pt-2.5">
          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[13px] font-semibold text-white">{initials}</div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{profileValue(name)}</div>
            <div className="truncate font-mono text-[11px] text-zinc-400">{profileValue(email)}</div>
          </div>
        </div>
        <div className="border-b border-zinc-100 px-2.5 py-2">
          <div className="mb-1 font-semibold text-zinc-500">Personal Information</div>
          {[["Full Name", profileValue(name)], ["Email", profileValue(email)]].map(([label, value]) => (
            <div key={label} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0">
              <span className="text-zinc-500">{label}</span>
              <span className="ml-3 truncate font-mono font-medium">{value}</span>
            </div>
          ))}
          <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Address</div>
          {[
            ["Street Address", profileValue(address.street_address)],
            ["City", profileValue(address.locality)],
            ["State", profileValue(address.region)],
            ["Country", profileValue(address.country)],
            ["Postal Code", profileValue(address.postal_code)],
          ].map(([label, value]) => (
            <div key={label} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0">
              <span className="text-zinc-500">{label}</span>
              <span className="ml-3 truncate font-mono font-medium">{value}</span>
            </div>
          ))}
          <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Account Information</div>
          <div className="mb-1.5 flex justify-between text-[11.5px]">
            <span className="text-zinc-500">Account verification status</span>
            <span className={`ml-3 flex items-center gap-[5px] font-mono font-medium ${user.verified ? "text-green-800" : ""}`}>
              {user.verified && <span className="size-1.5 rounded-full bg-green-500" />}{accountStatus}
            </span>
          </div>
          <div className="mb-1.5 flex justify-between text-[11.5px]">
            <span className="text-zinc-500">PayPal account ID (payer ID)</span>
            <span className="ml-3 truncate font-mono font-medium">{profileValue(user.payer_id, profileValue(user.user_id))}</span>
          </div>
          <div className="mt-2.5 flex justify-between text-[11.5px]">
            <span className="text-zinc-500">Base currency</span>
            <span className="font-mono font-medium">SGD</span>
          </div>
        </div>
        <div className="pt-1.5">
          <MenuItem onClick={onLogout} className="text-red-800 data-[highlighted]:bg-red-100">
            <LogOut className="size-3.5" /> Log out
          </MenuItem>
        </div>
      </MenuPopup>
    </Menu>
  </div>);
}

function StatusPill({ loading, dataState }) {
  if (!loading && dataState !== "demo") return null;
  const config = loading
    ? { text: "Fetching quotes...", classes: "text-zinc-500 bg-zinc-100 border-zinc-200", dot: "bg-zinc-400 anim-pulse" }
    : { text: "DEMO MODE · offline data", classes: "text-yellow-800 bg-yellow-100 border-yellow-200", dot: "bg-yellow-500" };
  return (<div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] font-mono text-[11px] font-semibold ${config.classes}`}>
    <span className={`size-1.5 rounded-full ${config.dot}`} /><span>{config.text}</span>
  </div>);
}

function relativeUpdated(timestamp, now) {
  if (!timestamp) return "—";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "~now";
  if (seconds < 3600) return `~${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `~${Math.floor(seconds / 3600)}h ago`;
  return `~${Math.floor(seconds / 86400)}d ago`;
}

export function VictorTopBar({
  user, onNavigate, fx, loading, refreshing, refreshError, lastUpdatedAt, dataState,
  addableSymbols, portfolioOnCanvas, onAddSymbol, onAddPortfolio, onRefresh, onLogout,
}) {
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const query = search.trim().toLowerCase();
  const filteredSymbols = query
    ? addableSymbols.filter((stock) => stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query))
    : addableSymbols;

  return (<div className="relative z-[500] flex h-14 shrink-0 items-center gap-3.5 border-b border-zinc-200 bg-white px-5">
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-[7px] bg-zinc-900 font-mono text-[13px] font-semibold text-white">S</div>
      <div className="text-sm font-semibold tracking-tight">Straits Digital</div>
      <Menu>
        <MenuTrigger className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
          <span>/ Stocks</span><ChevronDown className="size-3" />
        </MenuTrigger>
        <MenuPopup className="w-[190px]">
          {SECTIONS.map((section) => (<MenuItem key={section.label} onClick={() => onNavigate(section.label)} className={section.label === "Stocks" ? "bg-zinc-100" : ""}>
            <span className="flex-1">{section.label}</span><span className="font-mono text-[10px] font-normal text-zinc-400">{section.note}</span>
          </MenuItem>))}
        </MenuPopup>
      </Menu>
    </div>
    <div className="flex-1" />
    <StatusPill loading={loading || refreshing} dataState={dataState} />
    <div className="font-mono text-[10.5px] text-zinc-400" title={lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "Waiting for market data"}>
      Last updated {relativeUpdated(lastUpdatedAt, now)}
    </div>
    <button type="button" aria-label="Refresh live stock prices and USD to SGD rate" title={refreshError ? "Refresh failed - showing the last saved data" : "Refresh live stock prices and USD/SGD"} disabled={loading || refreshing} onClick={onRefresh} className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50">
      <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </button>
    <div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-[5px] font-mono text-[11.5px] text-zinc-500">
      1 USD = S${fx.rate.toFixed(4)} · {fx.source === "demo" ? "fixed" : "ECB"}
    </div>
    <Menu onOpenChange={(open) => !open && setSearch("")}>
      <MenuTrigger render={<Button variant="outline" className="px-3.5 py-[7px]">+ Add stock</Button>} />
      <MenuPopup align="end" className="w-[330px]">
        <div className="relative mb-1.5" onClick={(event) => event.stopPropagation()}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Search ticker or company" aria-label="Search stocks" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-2.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white" />
        </div>
        {!portfolioOnCanvas && (<MenuItem onClick={onAddPortfolio}>
          <span className="min-w-11 font-mono text-xs font-semibold">PF</span>
          <span className="flex-1 truncate text-xs font-normal text-zinc-500">Portfolio · holdings &amp; performance</span>
        </MenuItem>)}
        <div className="max-h-[340px] overflow-y-auto">
          {filteredSymbols.map((stock) => (<MenuItem key={stock.symbol} onClick={() => onAddSymbol(stock.symbol)}>
            <span className="min-w-11 font-mono text-xs font-semibold">{stock.symbol}</span>
            <span className="flex-1 truncate text-xs font-normal text-zinc-500">{stock.name}</span>
            <span className="font-mono text-[11px] text-zinc-500">{fmtUsd(stock.price)}</span>
            <span className="min-w-[54px] text-right font-mono text-[11.5px] font-semibold" style={{ color: stock.change_pct >= 0 ? "#166534" : "#991b1b" }}>{fmtPct(stock.change_pct)}</span>
          </MenuItem>))}
          {filteredSymbols.length === 0 && <div className="p-3 text-center text-xs text-zinc-400">{query ? "No stocks match your search" : "All available stocks are on the canvas"}</div>}
        </div>
      </MenuPopup>
    </Menu>
    <ProfileMenu user={user} onLogout={onLogout} />
  </div>);
}
