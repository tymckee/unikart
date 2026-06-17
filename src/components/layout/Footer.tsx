import Link from "next/link";
import { WheelLogo } from "@/components/brand/WheelLogo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate">
            <WheelLogo size={20} className="text-titanium" />
            <span className="text-sm">UniKart — a calm way to buy.</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate">
            <Link href="/settings" className="hover:text-ink">
              Settings
            </Link>
            <Link href="/settings#privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/settings#disclosure" className="hover:text-ink">
              Affiliate disclosure
            </Link>
          </nav>
        </div>
        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-silver">
          UniKart helps you organize and track products you find across the web.
          Some links may become affiliate links in the future — if they do,
          we&apos;ll disclose it clearly and it will never change your price.
          UniKart does not process payments and checkout always happens on the
          merchant&apos;s own site.
        </p>
      </div>
    </footer>
  );
}
