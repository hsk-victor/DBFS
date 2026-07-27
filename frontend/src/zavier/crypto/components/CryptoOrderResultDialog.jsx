import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogPopup } from "@/shared/components/ui/dialog";
import { fmtQty, fmtSgd, fmtUsd } from "@/shared/lib/format";

function row(label, value) {
    return (
        <div key={label} className="flex justify-between border-b border-zinc-100 py-[7px] text-[11.5px]">
            <span className="text-zinc-500">{label}</span>
            <span className="font-mono font-medium text-right">{value}</span>
        </div>
    );
}

export function CryptoOrderResultDialog({ result, onClose }) {
    const order = result?.order ?? null;
    const paypal = result?.paypal ?? null;
    const status = result?.status ?? order?.status ?? "filled";
    const payerName = paypal?.payer?.name ? [paypal.payer.name.given_name, paypal.payer.name.surname].filter(Boolean).join(" ") : "—";
    const payerEmail = paypal?.payer?.email_address ?? "—";

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogPopup className="w-[380px] max-w-[calc(100vw-24px)] p-[18px]">
                <div className="text-center">
                    <div
                        className="mx-auto mb-2.5 flex size-[38px] items-center justify-center rounded-full text-[18px]"
                        style={{
                            background: status === "filled" ? "#dcfce7" : status === "cancelled" ? "#f4f4f5" : "#fee2e2",
                            color: status === "filled" ? "#166534" : status === "cancelled" ? "#52525b" : "#991b1b",
                        }}
                    >
                        {status === "filled" ? "✓" : status === "cancelled" ? "—" : "✕"}
                    </div>
                    <div className="text-[15px] font-semibold">
                        {status === "filled" ? "Crypto order complete" : status === "cancelled" ? "Checkout cancelled" : "Payment failed"}
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                        {status === "filled"
                            ? "PayPal approved and captured successfully."
                            : status === "cancelled"
                                ? "No payment was captured."
                                : "The PayPal checkout did not complete."}
                    </div>
                </div>

                {order && (
                    <div className="mt-3 border-t border-zinc-100">
                        {[
                            ["Order ID", order.order_id ?? "—"],
                            ["Symbol", order.symbol ?? "—"],
                            ["Quantity", fmtQty(Number(order.shares ?? 0))],
                            ["Price (USD)", fmtUsd(Number(order.price_usd ?? 0))],
                            ["Subtotal (USD)", fmtUsd(Number(order.usd_total ?? 0))],
                            ["FX", `1 USD = S$${Number(order.fx_rate ?? 0).toFixed(4)}`],
                            ["You paid", fmtSgd(Number(order.sgd_total ?? 0))],
                            ["Status", order.status ?? status],
                            ["Created", order.time_label ?? "—"],
                        ].map(([label, value]) => row(label, value))}
                    </div>
                )}

                {paypal && (
                    <div className="mt-3 border-t border-zinc-100">
                        <div className="mb-1.5 pt-2.5 font-mono text-[9.5px] text-zinc-400">PayPal</div>
                        {[
                            ["PayPal ID", paypal.id ?? "—"],
                            ["PayPal status", paypal.status ?? "—"],
                            ["Payer", payerName],
                            ["Payer email", payerEmail],
                        ].map(([label, value]) => row(label, value))}
                    </div>
                )}

                <Button onClick={onClose} className="mt-3 w-full rounded-[10px] py-[10px] text-[13px]">
                    Done
                </Button>
            </DialogPopup>
        </Dialog>
    );
}