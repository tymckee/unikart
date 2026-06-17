"use client";

import { Fingerprint, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The two passwordless alternatives offered on both sign-in and sign-up:
 * a magic link and a passkey (Face ID / Touch ID). Pure presentation — the
 * parent owns the auth-client calls and loading/error state.
 */
export function AltMethods({
  onMagicLink,
  onPasskey,
  magicLinkLabel = "Continue with a magic link",
  passkeyLabel = "Use a passkey",
  magicLoading = false,
  passkeyLoading = false,
  disabled = false,
}: {
  onMagicLink: () => void;
  onPasskey: () => void;
  magicLinkLabel?: string;
  passkeyLabel?: string;
  magicLoading?: boolean;
  passkeyLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onMagicLink}
        loading={magicLoading}
        disabled={disabled || passkeyLoading}
      >
        {!magicLoading && <Mail size={16} />}
        {magicLinkLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onPasskey}
        loading={passkeyLoading}
        disabled={disabled || magicLoading}
      >
        {!passkeyLoading && <Fingerprint size={16} />}
        {passkeyLabel}
      </Button>
    </div>
  );
}
