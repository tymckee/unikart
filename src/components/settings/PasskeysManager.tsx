"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { SettingsSection } from "./SettingsSection";

interface PasskeyRow {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  createdAt?: string | Date | null;
}

/**
 * Security › Passkeys. Lists the user's registered passkeys and lets them add
 * one (Face ID / Touch ID / security key) or remove an existing one — all via
 * the Better Auth passkey client.
 */
export function PasskeysManager({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await authClient.passkey.listUserPasskeys();
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t load your passkeys."));
    } else {
      setPasskeys((data ?? []) as PasskeyRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load on mount. refresh() only sets state after an await, so this is a
    // deferred fetch rather than a synchronous setState cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function add() {
    setError(null);
    setAdding(true);
    const res = await authClient.passkey.addPasskey({
      name: defaultPasskeyName(),
    });
    setAdding(false);
    if (res?.error) {
      // A user-cancelled WebAuthn prompt is not worth alarming about.
      const code = "code" in res.error ? res.error.code : undefined;
      if (code !== "PASSKEY_REGISTRATION_FAILED") {
        setError(friendlyAuthError(res.error, "We couldn’t add that passkey."));
      }
      return;
    }
    await refresh();
    onNotify("Passkey added. You can sign in with it next time.");
  }

  async function remove(id: string) {
    setError(null);
    setRemovingId(id);
    const { error } = await authClient.passkey.deletePasskey({ id });
    setRemovingId(null);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t remove that passkey."));
      return;
    }
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
    onNotify("Passkey removed.");
  }

  return (
    <SettingsSection
      title="Passkeys"
      description="Sign in with Face ID, Touch ID, or a security key — no password to remember."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-slate">
          <WheelSpinner size={16} /> Loading passkeys…
        </div>
      ) : passkeys.length === 0 ? (
        <div className="px-5 py-5">
          <p className="text-sm text-slate">
            No passkeys yet. Add one for the fastest, calmest sign-in.
          </p>
        </div>
      ) : (
        <ul>
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                  <Fingerprint size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {pk.name?.trim() || "Passkey"}
                  </p>
                  <p className="text-xs text-slate">
                    {[
                      pk.deviceType === "singleDevice"
                        ? "This device"
                        : pk.deviceType === "multiDevice"
                          ? "Synced"
                          : null,
                      pk.createdAt ? `Added ${formatDate(pk.createdAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Registered"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(pk.id)}
                loading={removingId === pk.id}
                aria-label={`Remove ${pk.name?.trim() || "passkey"}`}
              >
                {removingId !== pk.id && <Trash2 size={15} />} Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
        {error && <p className="text-xs text-up">{error}</p>}
        <div>
          <Button variant="secondary" size="sm" onClick={add} loading={adding}>
            {!adding && <Plus size={15} />} Add a passkey
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

function defaultPasskeyName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone / iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "This device";
}

function formatDate(value: string | Date): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
