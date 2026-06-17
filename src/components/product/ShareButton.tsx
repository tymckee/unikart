"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: `${title} · UniKart`, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={share}>
      {copied ? <Check size={15} /> : <Share size={15} />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}
