/** shadcn-style modal dialog on the Base UI Dialog primitive. */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "@/shared/lib/utils";
export const Dialog = BaseDialog.Root;
export function DialogPopup({ className, children, ...props }) {
    return (<BaseDialog.Portal>
      <BaseDialog.Backdrop className="anim-fade fixed inset-0 z-[1000] bg-zinc-900/45"/>
      <BaseDialog.Popup className={cn("anim-dlg fixed left-1/2 top-1/2 z-[1001] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.28)] outline-none", className)} {...props}>
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>);
}
