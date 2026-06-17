import Link from "next/link";
import { cn } from "@/lib/utils";
import { WheelSpinner } from "@/components/brand/WheelLoader";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type ButtonAsButton = BaseProps &
  Omit<React.ComponentPropsWithoutRef<"button">, keyof BaseProps> & {
    href?: undefined;
  };
type ButtonAsLink = BaseProps &
  Omit<React.ComponentPropsWithoutRef<"a">, keyof BaseProps> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 ease-out tap-highlight-none select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white shadow-soft hover:bg-obsidian hover:shadow-lift",
  secondary:
    "bg-white text-ink border border-line hover:border-line-strong hover:bg-canvas shadow-soft",
  ghost: "text-ink hover:bg-canvas",
  quiet: "text-slate hover:text-ink hover:bg-canvas",
  danger: "bg-up text-white hover:brightness-95 shadow-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.8125rem]",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[0.95rem]",
  icon: "h-10 w-10",
};

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    className,
    children,
    ...rest
  } = props;

  const cls = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading && <WheelSpinner size={16} />}
      {children}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as React.ComponentPropsWithoutRef<"a">;
    return (
      <Link href={href ?? "#"} className={cls} {...anchorRest}>
        {content}
      </Link>
    );
  }

  const buttonRest = rest as React.ComponentPropsWithoutRef<"button">;
  return (
    <button
      className={cls}
      disabled={loading || buttonRest.disabled}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
