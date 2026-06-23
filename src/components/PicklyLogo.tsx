import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

/**
 * Swipe-card style logo: two stacked, tilted cards with a check mark on top.
 * Uses gradient brand tokens.
 */
export function PicklyLogo({ size = 36, className, showWordmark = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-label="Pickly"
      >
        {/* back card */}
        <div
          className="absolute inset-0 rounded-[28%] bg-gradient-brand-soft border border-white/10"
          style={{ transform: "rotate(-14deg) translate(-6%, 4%)" }}
        />
        {/* front card */}
        <div
          className="absolute inset-0 rounded-[28%] bg-gradient-brand glow-primary"
          style={{ transform: "rotate(8deg)" }}
        >
          <div className="absolute inset-[18%] rounded-[18%] border-2 border-white/85" />
          <svg
            viewBox="0 0 24 24"
            className="absolute right-[14%] bottom-[12%] w-[36%] h-[36%] text-background"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </div>
      </div>
      {showWordmark && (
        <span className="text-xl font-bold tracking-tight">
          Pickly
        </span>
      )}
    </div>
  );
}
