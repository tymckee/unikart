import Link from "next/link";
import { ShieldX } from "lucide-react";
import { WheelLogo } from "@/components/brand/WheelLogo";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { ROLE_META } from "@/lib/ops/permissions";
import type { Role } from "@/lib/ops/permissions";

/**
 * Shown to an authenticated user whose role can't access the requested area.
 * The attempt is logged server-side before this renders. Calm and clear — no
 * blame, no detail about what exists.
 */
export function OpsAccessDenied({
  role,
  needed,
}: {
  role?: Role;
  needed?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-porcelain px-4">
      <div className="mb-8">
        <WheelLogo size={40} />
      </div>
      <GlassCard className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-slate">
          <ShieldX size={22} />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">
          You don’t have access to this
        </h1>
        <p className="mt-2 text-sm text-slate text-pretty">
          {role
            ? `Your role (${ROLE_META[role]?.label ?? role}) can’t open this area of UniKart Ops.`
            : "Your account can’t open UniKart Ops."}
          {needed ? ` It needs the ${needed} permission.` : ""} If you think this
          is a mistake, ask an Owner to adjust your role.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button href="/ops" variant="secondary">
            Back to Overview
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center px-4 text-sm text-slate transition-colors hover:text-ink"
          >
            Go to UniKart
          </Link>
        </div>
      </GlassCard>
      <p className="mt-6 text-xs text-silver">This attempt was logged.</p>
    </main>
  );
}
