import { FlaskConical } from "lucide-react";
import { Pill } from "@/components/ui/Pill";

/**
 * Honesty marker. Whenever a number or chart is mock/fallback (no real data
 * yet), it MUST carry this badge — UniKart never presents fabricated data as
 * real (brand non-negotiable). Calm, not alarming.
 */
export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <Pill tone="outline" icon={<FlaskConical size={11} />}>
      {label}
    </Pill>
  );
}
