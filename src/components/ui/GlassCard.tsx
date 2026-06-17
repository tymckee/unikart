import { cn } from "@/lib/utils";

type Variant = "glass" | "glass-strong" | "solid" | "plain";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /** Adds a hover lift for interactive cards. */
  interactive?: boolean;
  as?: "div" | "article" | "section";
}

const variants: Record<Variant, string> = {
  glass: "glass",
  "glass-strong": "glass-strong",
  solid: "surface",
  plain: "bg-white border border-line",
};

/** Rounded glass / porcelain panel — the core surface of UniKart. */
export function GlassCard({
  variant = "solid",
  interactive = false,
  as: Tag = "div",
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl",
        variants[variant],
        interactive && "lift cursor-pointer tap-highlight-none",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
