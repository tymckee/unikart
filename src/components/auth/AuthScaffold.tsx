import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/WheelLogo";
import { cn } from "@/lib/utils";

/**
 * The calm centered shell shared by every auth screen (sign-in, sign-up,
 * verify, forgot/reset password). Porcelain field, a hairline glass card, the
 * wordmark up top, and a quiet "Back" affordance. Keeps all auth surfaces
 * visually identical so the flow feels like one continuous, unhurried place.
 */
export function AuthScaffold({
  title,
  subtitle,
  children,
  footer,
  back = { href: "/", label: "Back" },
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  back?: { href: string; label: string } | null;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-porcelain">
      <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        {back && (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-sm text-slate transition-colors hover:text-ink"
          >
            <ChevronLeft size={16} /> {back.label}
          </Link>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link href="/" aria-label="UniKart home">
              <Wordmark size={32} textClassName="text-lg" />
            </Link>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-pretty text-sm text-slate">{subtitle}</p>
            )}
          </div>

          <div className="glass-strong rounded-3xl p-6">{children}</div>

          {footer && (
            <p className="mt-5 text-center text-sm text-slate">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** A quiet "or" divider between the primary form and alternative methods. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-silver">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Inline form error — calm red, left-aligned under the field. */
export function AuthError({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p className={cn("pl-2 text-xs text-up", className)} role="alert">
      {children}
    </p>
  );
}
