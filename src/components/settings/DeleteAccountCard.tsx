"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SettingsRow } from "./SettingsSection";

const CONFIRM_WORD = "DELETE";

/**
 * Danger zone › Delete account. A deliberately slow, two-gate confirm: type
 * DELETE and re-enter your password. Backed by authClient.deleteUser, which
 * verifies the password and cascades the removal (products, collections,
 * sessions, passkeys). On success we route home.
 */
export function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setWord("");
    setPassword("");
    setError(null);
    setPending(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (word.trim().toUpperCase() !== CONFIRM_WORD)
      return setError(`Type ${CONFIRM_WORD} to confirm.`);
    if (!password) return setError("Enter your password to confirm.");

    setPending(true);
    const { error } = await authClient.deleteUser({ password });
    if (error) {
      setPending(false);
      setError(friendlyAuthError(error, "We couldn’t delete your account."));
      return;
    }
    // Session is gone; leave the app.
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <SettingsRow
        label="Delete account"
        description="Permanently remove your account, saved products, and all data."
        control={
          <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
            <Trash2 size={15} /> Delete
          </Button>
        }
      />

      <Modal open={open} onClose={close} title="Delete your account">
        <form onSubmit={submit} className="space-y-4 px-6 pb-6 pt-4">
          <div className="flex items-start gap-2.5 rounded-2xl bg-up-soft px-4 py-3.5 text-sm text-up">
            <TriangleAlert size={17} className="mt-px shrink-0" />
            <p className="text-pretty leading-relaxed">
              This permanently deletes your account and everything in it —
              saved products, collections, alerts, and passkeys. It can’t be
              undone.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate">
              Type <span className="font-semibold text-ink">{CONFIRM_WORD}</span>{" "}
              to confirm
            </label>
            <Input
              type="text"
              value={word}
              onChange={(e) => {
                setWord(e.target.value);
                if (error) setError(null);
              }}
              placeholder={CONFIRM_WORD}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate">Confirm your password</label>
            <PasswordInput
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="pl-2 text-xs text-up">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={pending}>
              {!pending && <Trash2 size={15} />} Delete account
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
