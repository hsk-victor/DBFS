export const SECTIONS = [
  { label: "Stocks", note: "Victor" },
  { label: "Crypto", note: "Zavier" },
  { label: "Forex", note: "Ong Xuan" },
];

export function sectionFromLocation() {
  const query = new URLSearchParams(window.location.search);
  const requested = String(query.get("section") ?? "").trim().toLowerCase();
  if (requested === "crypto" || query.has("crypto_order_status") || query.has("crypto_order_id"))
    return "Crypto";
  if (requested === "forex" || query.has("forex_status") || query.has("forex_order_id"))
    return "Forex";
  return "Stocks";
}

export function sectionUrl(section) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("section", section);
  return `${url.pathname}${url.search}`;
}
