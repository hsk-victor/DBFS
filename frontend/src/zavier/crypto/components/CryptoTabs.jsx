export function CryptoTabs({ value, tabs, onChange }) {
    return (
        <div className="flex gap-0.5 rounded-[9px] bg-zinc-100 p-[3px]">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className="flex-1 cursor-pointer rounded-[7px] px-3.5 py-[5px] text-xs font-semibold"
                    style={{
                        background: value === tab.id ? "#ffffff" : "transparent",
                        color: value === tab.id ? "#18181b" : "#71717a",
                        boxShadow: value === tab.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
