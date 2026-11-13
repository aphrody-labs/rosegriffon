import { cn } from "@/lib/utils";

// Mapping simpler keys to icons
export type PlatformType =
  "ps4" | "ps5" | "steam" | "switch" | "xbox" | "mobile";

interface PlatformBadgeProps {
  platform: PlatformType | string;
  className?: string;
  showLabel?: boolean;
}

export function PlatformBadge({
  platform,
  className,
  showLabel = false,
}: PlatformBadgeProps) {
  const p = platform.toLowerCase();

  let iconSrc: string | null = null;
  let label = platform;
  let bgClass = "bg-surface-container-highest text-on-surface-variant";

  if (p.includes("ps") || p.includes("playstation")) {
    iconSrc = "/icons/platforms/playstation.jpg";
    bgClass =
      "bg-[#003087]/10 text-[#003087] dark:text-[#00439c] dark:bg-[#00439c]/20";
    if (p.includes("5")) {
      label = "PlayStation 5";
    } else if (p.includes("4")) {
      label = "PlayStation 4";
    }
  }

  if (p.includes("steam") || p.includes("pc")) {
    // If it was ps-steam, we might have set PS above.
    // If purely steam, set steam.
    // If ps-steam, this overwrites to steam?
    // Better logic: Strict checks.
    iconSrc = "/icons/platforms/steam.ico";
    bgClass =
      "bg-[#171a21]/10 text-[#171a21] dark:text-[#c7d5e0] dark:bg-[#ffffff]/10";
    label = "Steam";
  }

  if (p.includes("ps") && (p.includes("steam") || p.includes("pc"))) {
    // Hybrid: Use PS for now if single icon required, or a split?
    // Let's assume the parent splits provided 'ps-steam' into 'ps' and 'steam'.
    // But if we get 'ps-steam' here, show PS as it's the console.
    iconSrc = "/icons/platforms/playstation.jpg";
    label = "PlayStation / Steam";
  }

  if (p.includes("switch")) {
    iconSrc = "/icons/platforms/nintendo.png";
    bgClass =
      "bg-[#e60012]/10 text-[#e60012] dark:text-[#ff4d5a] dark:bg-[#ff4d5a]/20";
    label = "Nintendo Switch";
  }

  if (p.includes("xbox")) {
    iconSrc = "/icons/platforms/xbox.png";
    bgClass =
      "bg-[#107c10]/10 text-[#107c10] dark:text-[#107c10] dark:bg-[#107c10]/20";
    label = "Xbox";
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold border border-transparent",
        bgClass,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {iconSrc && (
        <img
          src={iconSrc}
          alt={label}
          className="size-4 rounded-[3px] object-contain"
        />
      )}
      {showLabel && <span>{label}</span>}
    </div>
  );
}
