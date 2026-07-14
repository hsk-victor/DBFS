import { cn } from "@/shared/lib/utils";
const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-default",
    outline: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100",
    ghost: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
    paypal: "bg-[#0070BA] text-white hover:bg-[#005C99] disabled:opacity-70 disabled:cursor-default",
};
export function Button({ variant = "primary", className, type = "button", ...props }) {
    return (<button type={type} className={cn("cursor-pointer rounded-lg text-[12.5px] font-semibold transition-colors", variants[variant], className)} {...props}/>);
}
