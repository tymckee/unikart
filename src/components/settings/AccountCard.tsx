"use client";

import { useState } from "react";
import { BadgeCheck, Check, Pencil } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { SettingsSection, SettingsRow } from "./SettingsSection";

interface AccountUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  plan: "free" | "pro";
}

/**
 * Account section: avatar/initial, editable display name, email with a verified
 * badge, and the plan. Name edits go through authClient.updateUser; useSession
 * keeps the live values (email/verified) fresh after any change.
 */
export function AccountCard({
  initialUser,
  onNotify,
}: {
  initialUser: AccountUser;
  onNotify: (message: string) => void;
}) {
  const { data: session } = useSession();
  const live = session?.user;

  const name = (live?.name as string | undefined) ?? initialUser.name;
  const email = (live?.email as string | undefined) ?? initialUser.email;
  const image = (live?.image as string | null | undefined) ?? initialUser.image;
  const verified = live?.emailVerified ?? true;
  const plan = ((live as { plan?: string } | undefined)?.plan ?? initialUser.plan) as
    | "free"
    | "pro";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [resending, setResending] = useState(false);

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = draft.trim();
    if (!value) return setError("Your name can’t be empty.");
    if (value === name) {
      setEditing(false);
      return;
    }
    setSavingName(true);
    const { error } = await authClient.updateUser({ name: value });
    setSavingName(false);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t update your name."));
      return;
    }
    setEditing(false);
    onNotify("Your name has been updated.");
  }

  async function resendVerification() {
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/verify-email?welcome=1",
    });
    setResending(false);
    if (!error) onNotify("Confirmation email sent.");
  }

  return (
    <SettingsSection title="Account">
      {/* Identity */}
      <div className="flex items-center gap-4 border-b border-line px-5 py-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-base font-semibold text-white">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError(null);
                }}
                aria-label="Display name"
                autoComplete="name"
                className="h-9"
                autoFocus
              />
              <Button type="submit" size="sm" loading={savingName}>
                {!savingName && <Check size={15} />} Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(name);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <Pill tone={plan === "pro" ? "ink" : "neutral"}>
                {plan === "pro" ? "Pro" : "Free"}
              </Pill>
            </div>
          )}
          {!editing && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="truncate text-xs text-slate">{email}</p>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-down">
                  <BadgeCheck size={13} /> Verified
                </span>
              ) : (
                <span className="text-xs text-warn">Unverified</span>
              )}
            </div>
          )}
        </div>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            aria-label="Edit name"
          >
            <Pencil size={15} /> Edit
          </Button>
        )}
      </div>

      {error && !editing && (
        <p className="border-b border-line px-5 py-2 text-xs text-up">{error}</p>
      )}

      {/* Verify-email nudge */}
      {!verified && (
        <SettingsRow
          label="Confirm your email"
          description="We sent a link when you signed up. Resend it if you need a fresh one."
          control={
            <Button
              variant="secondary"
              size="sm"
              onClick={resendVerification}
              loading={resending}
            >
              Resend
            </Button>
          }
        />
      )}
    </SettingsSection>
  );
}
