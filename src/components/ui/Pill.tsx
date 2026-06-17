import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "ink"
  | "accent"
  | "down"
  | "up"
  | "warn"
  | "outline";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: "sm" | "md";
  dot?: boolean;
  icon?: React.ReactNode;
}

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-slate",
  ink: "bg-ink text-white",
  accent: "bg-accent-soft text-accent-ink",
  down: "bg-down-soft text-down",
  up: "bg-up-soft text-up",
  warn: "bg-warn-soft text-warn",
  outline: "border border-line text-slate bg-white/60",
};

const dotColor: Record<Tone, string> = {
  neutral: "bg-silver",
  ink: "bg-white",
  accent: "bg-accent",
  down: "bg-down",
  up: "bg-up",
  warn: "bg-warn",
  outline: "bg-silver",
};

/** Compact status chip / collection tag. */
export function Pill({
  tone = "neutral",
  size = "sm",
  dot = false,
  icon,
  className,
  children,
  ...props
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-[0.6875rem]" : "px-3 py-1 text-xs",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone])} />
      )}
      {icon && <span className="-ml-0.5 inline-flex">{icon}</span>}
      {children}
    </span>
  );
}
