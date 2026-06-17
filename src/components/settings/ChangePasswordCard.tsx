"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SettingsRow } from "./SettingsSection";

/**
 * Security › Change password. Opens a calm modal that takes the current and a
 * new password, with an option to sign out other sessions. Backed by
 * authClient.changePassword.
 */
export function ChangePasswordCard({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setRevokeOthers(true);
    setError(null);
    setPending(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (next.length < 8)
      return setError("Use at least 8 characters for your new password.");
    if (next !== confirm) return setError("Those new passwords don’t match.");

    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    });
    setPending(false);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t change your password."));
      return;
    }
    close();
    onNotify("Your password has been updated.");
  }

  return (
    <>
      <SettingsRow
        label="Change password"
        description="Update the password you use to sign in."
        control={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        }
      />

      <Modal
        open={open}
        onClose={close}
        title="Change password"
        description="Enter your current password, then choose a new one."
      >
        <form onSubmit={submit} className="space-y-3 px-6 pb-6 pt-5">
          <PasswordInput
            value={current}
            onChange={(v) => {
              setCurrent(v);
              if (error) setError(null);
            }}
            placeholder="Current password"
            autoComplete="current-password"
            ariaLabel="Current password"
          />
          <PasswordInput
            value={next}
            onChange={(v) => {
              setNext(v);
              if (error) setError(null);
            }}
            placeholder="New password"
            autoComplete="new-password"
            ariaLabel="New password"
          />
          <PasswordInput
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              if (error) setError(null);
            }}
            placeholder="Confirm new password"
            autoComplete="new-password"
            ariaLabel="Confirm new password"
          />

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                Sign out other devices
              </p>
              <p className="mt-0.5 text-xs text-slate">
                End every other active session as a precaution.
              </p>
            </div>
            <Switch
              checked={revokeOthers}
              onCheckedChange={setRevokeOthers}
              label="Sign out other devices"
            />
          </div>

          {error && <p className="pl-2 text-xs text-up">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Update password
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
