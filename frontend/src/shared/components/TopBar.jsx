import { useEffect, useState } from "react";
import { ChevronDown, LogOut, RefreshCw, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/shared/components/ui/menu";
import { fmtPct, fmtUsd } from "@/shared/lib/format";
const SECTIONS = [
  { label: "Stocks", note: "Victor" },
  { label: "Crypto", note: "Zavier" },
  { label: "Forex", note: "Ong Xuan" },
];
function StatusPill({ loading, dataState }) {
  if (!loading && dataState !== "demo")
    return null;
  const conf = loading
    ? { text: "Fetching quotes…", cls: "text-zinc-500 bg-zinc-100 border-zinc-200", dot: "bg-zinc-400 anim-pulse" }
    : dataState === "cached"
      ? { text: "CACHED · Supabase", cls: "text-yellow-800 bg-yellow-100 border-yellow-200", dot: "bg-yellow-500" }
      : { text: "DEMO MODE · offline data", cls: "text-yellow-800 bg-yellow-100 border-yellow-200", dot: "bg-yellow-500" };
  return (<div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] font-mono text-[11px] font-semibold ${conf.cls}`}>
    <span className={`size-1.5 rounded-full ${conf.dot}`} />
    <span>{conf.text}</span>
  </div>);
}
function relativeUpdated(timestamp, now) {
  if (!timestamp)
    return "—";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60)
    return "~now";
  if (seconds < 3600)
    return `~${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)
    return `~${Math.floor(seconds / 3600)}h ago`;
  return `~${Math.floor(seconds / 86400)}d ago`;
}

function profileValue(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function TopBar({ user, section, onSection, fx, loading, refreshing, refreshError, lastUpdatedAt, dataState, addableSymbols, cryptoAddableSymbols, portfolioOnCanvas, onAddSymbol, onAddCryptoSymbol, onAddPortfolio, onRefresh, onLogout, }) {
  const [stockSearch, setStockSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "PP";
  const isStocks = section === "Stocks";
  const isCrypto = section === "Crypto";
  const address = user.address || {};
  const accountStatus = user.verified ? "Verified" : "Unverified";
  const query = stockSearch.trim().toLowerCase();
  const filteredSymbols = query
    ? addableSymbols.filter((stock) => stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query))
    : addableSymbols;
  const filteredCrypto = query
    ? (cryptoAddableSymbols || []).filter((coin) => coin.symbol.toLowerCase().includes(query) || coin.name.toLowerCase().includes(query))
    : (cryptoAddableSymbols || []);
  return (<div className="relative z-[500] flex h-14 shrink-0 items-center gap-3.5 border-b border-zinc-200 bg-white px-5">
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-[7px] bg-zinc-900 font-mono text-[13px] font-semibold text-white">
        S
      </div>
      <div className="text-sm font-semibold tracking-tight">Straits Digital</div>

      <Menu>
        <MenuTrigger className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
          <span>/ {section}</span>
          <ChevronDown className="size-3" />
        </MenuTrigger>
        <MenuPopup className="w-[190px]">
          {SECTIONS.map((s) => (<MenuItem key={s.label} onClick={() => onSection(s.label)} className={section === s.label ? "bg-zinc-100" : ""}>
            <span className="flex-1">{s.label}</span>
            <span className="font-mono text-[10px] font-normal text-zinc-400">{s.note}</span>
          </MenuItem>))}
        </MenuPopup>
      </Menu>
    </div>

    <div className="flex-1" />

    {isStocks && (<>
      <StatusPill loading={loading || refreshing} dataState={dataState} />
      <div
        className="font-mono text-[10.5px] text-zinc-400"
        title={lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "Waiting for market data"}
      >
        Last updated {relativeUpdated(lastUpdatedAt, now)}
      </div>
      <button
        type="button"
        aria-label="Refresh live stock prices and USD to SGD rate"
        title={refreshError ? "Refresh failed - showing the last saved data" : "Refresh live stock prices and USD/SGD"}
        disabled={loading || refreshing}
        onClick={onRefresh}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
      </button>
      <div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-[5px] font-mono text-[11.5px] text-zinc-500">
        1 USD = S${fx.rate.toFixed(4)} · {fx.source === "demo" ? "fixed" : "ECB"}
      </div>

      <Menu onOpenChange={(open) => !open && setStockSearch("")}>
        <MenuTrigger render={<Button variant="outline" className="px-3.5 py-[7px]">+ Add stock</Button>} />
        <MenuPopup align="end" className="w-[330px]">
          <div className="relative mb-1.5" onClick={(event) => event.stopPropagation()}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              type="search"
              value={stockSearch}
              onChange={(event) => setStockSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search ticker or company"
              aria-label="Search stocks"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-2.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            />
          </div>
          {!portfolioOnCanvas && (<MenuItem onClick={onAddPortfolio}>
            <span className="min-w-11 font-mono text-xs font-semibold">PF</span>
            <span className="flex-1 truncate text-xs font-normal text-zinc-500">
              Portfolio · holdings &amp; performance
            </span>
          </MenuItem>)}
          <div className="max-h-[340px] overflow-y-auto">
            {filteredSymbols.map((s) => (<MenuItem key={s.symbol} onClick={() => onAddSymbol(s.symbol)}>
              <span className="min-w-11 font-mono text-xs font-semibold">{s.symbol}</span>
              <span className="flex-1 truncate text-xs font-normal text-zinc-500">{s.name}</span>
              <span className="font-mono text-[11px] text-zinc-500">{fmtUsd(s.price)}</span>
              <span className="min-w-[54px] text-right font-mono text-[11.5px] font-semibold" style={{ color: s.change_pct >= 0 ? "#166534" : "#991b1b" }}>
                {fmtPct(s.change_pct)}
              </span>
            </MenuItem>))}
            {filteredSymbols.length === 0 && (<div className="p-3 text-center text-xs text-zinc-400">
              {query ? "No stocks match your search" : "All available stocks are on the canvas"}
            </div>)}
          </div>
        </MenuPopup>
      </Menu>
    </>)}

    {isCrypto && (<button
      type="button"
      aria-label="Refresh crypto market data"
      title="Refresh crypto prices and related data"
      disabled={loading || refreshing}
      onClick={onRefresh}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </button>)}

    {isCrypto && (<div className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-[5px] font-mono text-[11.5px] text-zinc-500">
      1 USD = S${fx.rate.toFixed(4)} · {fx.source === "demo" ? "fixed" : "EODHD"}
    </div>)}

    {isCrypto && (<Menu onOpenChange={(open) => !open && setStockSearch("")}>
      <MenuTrigger render={<Button variant="outline" className="px-3.5 py-[7px]">+ Add crypto</Button>} />
      <MenuPopup align="end" className="w-[330px]">
        <div className="relative mb-1.5" onClick={(event) => event.stopPropagation()}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            autoFocus
            type="search"
            value={stockSearch}
            onChange={(event) => setStockSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search symbol or coin"
            aria-label="Search cryptocurrencies"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-2.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {filteredCrypto.map((coin) => (<MenuItem key={coin.symbol} onClick={() => onAddCryptoSymbol?.(coin.symbol)}>
            <span className="min-w-11 font-mono text-xs font-semibold">{coin.symbol}</span>
            <span className="flex-1 truncate text-xs font-normal text-zinc-500">{coin.name}</span>
          </MenuItem>))}
          {filteredCrypto.length === 0 && (<div className="p-3 text-center text-xs text-zinc-400">
            {query ? "No crypto assets match your search" : "No more crypto assets available"}
          </div>)}
        </div>
      </MenuPopup>
    </Menu>)}

    <div className="border-l border-zinc-200 pl-3.5">
      <Menu>
        <MenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100">
          <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600">
            {initials}
          </div>
          <div className="font-mono text-xs text-zinc-500">{user.email.split("@")[0] + "@" + (user.demo ? "sandbox" : user.email.split("@")[1] ?? "")}</div>
          <ChevronDown className="size-3 text-zinc-400" />
        </MenuTrigger>
        <MenuPopup align="end" className="w-[340px]">
          <div className="flex items-center gap-[11px] border-b border-zinc-100 px-2.5 pb-3 pt-2.5">
            <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[13px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">{user.name}</div>
              <div className="truncate font-mono text-[11px] text-zinc-400">{user.email}</div>
            </div>
          </div>
          <div className="border-b border-zinc-100 px-2.5 py-2">
            <div className="mb-1 font-semibold text-zinc-500">Personal Information</div>
            {[
              ["Full Name", profileValue(user.name)],
              ["Email", profileValue(user.email)],
            ].map(([k, v]) => (<div key={k} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0">
              <span className="text-zinc-500">{k}</span>
              <span className="ml-3 truncate font-mono font-medium">{v}</span>
            </div>))}

            <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Address</div>
            {[
              ["Street Address", profileValue(address.street_address)],
              ["City", profileValue(address.locality)],
              ["State", profileValue(address.region)],
              ["Country", profileValue(address.country)],
              ["Postal Code", profileValue(address.postal_code)],
            ].map(([k, v]) => (<div key={k} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0">
              <span className="text-zinc-500">{k}</span>
              <span className="ml-3 truncate font-mono font-medium">{v}</span>
            </div>))}

            <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Account Information</div>
            {[
              ["Account verification status", accountStatus],
              ["PayPal account ID (payer ID)", profileValue(user.payer_id, profileValue(user.user_id))],
            ].map(([k, v]) => (<div key={k} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0">
              <span className="text-zinc-500">{k}</span>
              {k === "Account verification status" && user.verified ? (<span className="ml-3 flex items-center gap-[5px] font-mono font-medium text-green-800">
                <span className="size-1.5 rounded-full bg-green-500" />
                {v}
              </span>) : (<span className="ml-3 truncate font-mono font-medium">{v}</span>)}
            </div>))}

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
    </div>
  </div>);
}
