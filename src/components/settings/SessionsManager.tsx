"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { SettingsSection } from "./SettingsSection";

interface SessionRow {
  id: string;
  token: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Security › Active sessions. Lists every device with a live session, marks the
 * current one, and offers "Sign out everywhere else" (revokeOtherSessions).
 */
export function SessionsManager({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const { data: current } = useSession();
  const currentToken = current?.session?.token;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await authClient.listSessions();
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t load your sessions."));
    } else {
      const rows = (data ?? []) as SessionRow[];
      // Current device first, then most-recently active.
      rows.sort((a, b) => {
        if (a.token === currentToken) return -1;
        if (b.token === currentToken) return 1;
        return (
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        );
      });
      setSessions(rows);
    }
    setLoading(false);
  }, [currentToken]);

  useEffect(() => {
    // Load on mount. All state updates inside refresh() happen after an await,
    // so this is a deferred fetch, not a synchronous setState cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function revokeOthers() {
    setError(null);
    setRevoking(true);
    const { error } = await authClient.revokeOtherSessions();
    setRevoking(false);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t sign out other devices."));
      return;
    }
    await refresh();
    onNotify("Signed out of all other devices.");
  }

  const otherCount = sessions.filter((s) => s.token !== currentToken).length;

  return (
    <SettingsSection
      title="Active sessions"
      description="Devices currently signed in to your account."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-slate">
          <WheelSpinner size={16} /> Loading sessions…
        </div>
      ) : (
        <ul>
          {sessions.map((s) => {
            const isCurrent = s.token === currentToken;
            const mobile = /Mobile|iPhone|Android/i.test(s.userAgent ?? "");
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                    {mobile ? <Smartphone size={17} /> : <Monitor size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {describeDevice(s.userAgent)}
                    </p>
                    <p className="text-xs text-slate">
                      {[
                        s.ipAddress || null,
                        s.createdAt ? `Started ${timeAgo(s.createdAt)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                {isCurrent && <Pill tone="accent">This device</Pill>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
        {error && <p className="text-xs text-up">{error}</p>}
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={revokeOthers}
            loading={revoking}
            disabled={otherCount === 0 || loading}
          >
            Sign out everywhere else
          </Button>
        </div>
        {!loading && otherCount === 0 && (
          <p className="text-xs text-slate">
            This is your only active session.
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

/** Best-effort, friendly device name from a raw user-agent string. */
function describeDevice(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  return browser ? `${browser} on ${os}` : os;
}
