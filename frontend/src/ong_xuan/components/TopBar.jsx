import { ChevronDown, LogOut } from "lucide-react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/shared/components/ui/menu";
import { SECTIONS } from "@/shared/lib/navigation";

function profileValue(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function OngXuanTopBar({ user, onNavigate, onLogout }) {
  const name = String(user.name ?? "");
  const email = String(user.email ?? "");
  const initials = name.split(" ").map((word) => word[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "PP";
  const address = user.address || {};
  const accountStatus = user.verified ? "Verified" : "Unverified";
  const emailParts = email.split("@");
  const emailLabel = `${emailParts[0] || "paypal"}@${user.demo ? "sandbox" : emailParts[1] || ""}`;

  return (<div className="relative z-[500] flex h-14 shrink-0 items-center gap-3.5 border-b border-zinc-200 bg-white px-5">
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-[7px] bg-zinc-900 font-mono text-[13px] font-semibold text-white">S</div>
      <div className="text-sm font-semibold tracking-tight">Straits Digital</div>
      <Menu>
        <MenuTrigger className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><span>/ Forex</span><ChevronDown className="size-3" /></MenuTrigger>
        <MenuPopup className="w-[190px]">{SECTIONS.map((section) => (<MenuItem key={section.label} onClick={() => onNavigate(section.label)} className={section.label === "Forex" ? "bg-zinc-100" : ""}><span className="flex-1">{section.label}</span><span className="font-mono text-[10px] font-normal text-zinc-400">{section.note}</span></MenuItem>))}</MenuPopup>
      </Menu>
    </div>
    <div className="flex-1" />
    <div className="border-l border-zinc-200 pl-3.5">
      <Menu>
        <MenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100">
          <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600">{initials}</div>
          <div className="font-mono text-xs text-zinc-500">{emailLabel}</div>
          <ChevronDown className="size-3 text-zinc-400" />
        </MenuTrigger>
        <MenuPopup align="end" className="w-[340px]">
          <div className="flex items-center gap-[11px] border-b border-zinc-100 px-2.5 pb-3 pt-2.5">
            <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[13px] font-semibold text-white">{initials}</div>
            <div className="min-w-0"><div className="text-[13.5px] font-semibold">{profileValue(name)}</div><div className="truncate font-mono text-[11px] text-zinc-400">{profileValue(email)}</div></div>
          </div>
          <div className="border-b border-zinc-100 px-2.5 py-2">
            <div className="mb-1 font-semibold text-zinc-500">Personal Information</div>
            {[["Full Name", profileValue(name)], ["Email", profileValue(email)]].map(([label, value]) => (<div key={label} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0"><span className="text-zinc-500">{label}</span><span className="ml-3 truncate font-mono font-medium">{value}</span></div>))}
            <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Address</div>
            {[["Street Address", profileValue(address.street_address)], ["City", profileValue(address.locality)], ["State", profileValue(address.region)], ["Country", profileValue(address.country)], ["Postal Code", profileValue(address.postal_code)]].map(([label, value]) => (<div key={label} className="mb-1.5 flex justify-between text-[11.5px] last:mb-0"><span className="text-zinc-500">{label}</span><span className="ml-3 truncate font-mono font-medium">{value}</span></div>))}
            <div className="mb-1 mt-2.5 font-semibold text-zinc-500">Account Information</div>
            <div className="mb-1.5 flex justify-between text-[11.5px]"><span className="text-zinc-500">Account verification status</span><span className={`ml-3 flex items-center gap-[5px] font-mono font-medium ${user.verified ? "text-green-800" : ""}`}>{user.verified && <span className="size-1.5 rounded-full bg-green-500" />}{accountStatus}</span></div>
            <div className="mb-1.5 flex justify-between text-[11.5px]"><span className="text-zinc-500">PayPal account ID (payer ID)</span><span className="ml-3 truncate font-mono font-medium">{profileValue(user.payer_id, profileValue(user.user_id))}</span></div>
            <div className="mt-2.5 flex justify-between text-[11.5px]"><span className="text-zinc-500">Base currency</span><span className="font-mono font-medium">SGD</span></div>
          </div>
          <div className="pt-1.5"><MenuItem onClick={onLogout} className="text-red-800 data-[highlighted]:bg-red-100"><LogOut className="size-3.5" /> Log out</MenuItem></div>
        </MenuPopup>
      </Menu>
    </div>
  </div>);
}
