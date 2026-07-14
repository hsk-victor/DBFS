/** shadcn-style dropdown menu on the Base UI Menu primitive. */
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/shared/lib/utils";
export const Menu = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;
export function MenuPopup({ className, sideOffset = 8, align = "start", children, ...props }) {
    return (<BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} align={align} className="z-[600] outline-none">
        <BaseMenu.Popup className={cn("anim-dlg rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] outline-none", className)} {...props}>
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>);
}
export function MenuItem({ className, ...props }) {
    return (<BaseMenu.Item className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-zinc-900 outline-none data-[highlighted]:bg-zinc-100", className)} {...props}/>);
}
