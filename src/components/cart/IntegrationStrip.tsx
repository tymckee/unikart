import { Bot, CreditCard, Store, Wallet, type LucideIcon } from "lucide-react";
import { mockIntegrations } from "@/lib/mock-data";
import type { IntegrationType } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

const ICON: Record<IntegrationType, LucideIcon> = {
  merchant: Store,
  payment: CreditCard,
  bnpl: Wallet,
  agentic: Bot,
  affiliate: Store,
};

/** Future-ready integration placeholders. Text only — no partner logos. */
export function IntegrationStrip() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {mockIntegrations.map((adapter) => {
        const Icon = ICON[adapter.type];
        return (
          <div
            key={adapter.id}
            className="rounded-2xl border border-line bg-white/60 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-canvas text-slate">
                <Icon size={17} />
              </span>
              <Pill tone="neutral">
                {adapter.status === "planned" ? "Planned" : adapter.status}
              </Pill>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{adapter.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate">
              {adapter.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
