"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { AuthScaffold, AuthError } from "@/components/auth/AuthScaffold";
import { PasswordInput } from "@/components/auth/PasswordInput";

/**
 * Target of the password-reset email. requestPasswordReset(redirectTo:
 * "/reset-password") sends Better Auth here with ?token=… on success, or
 * ?error=INVALID_TOKEN when the link is stale. We collect a new password and
 * call resetPassword({ token, newPassword }).
 */
function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8)
      return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Those passwords don’t match.");
    if (!token) return setError("This reset link is missing its token.");

    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t reset your password."));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthScaffold title="Password updated" back={null}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-down-soft text-down">
            <CircleCheck size={26} />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-slate">
            Your password is set. Sign in with it whenever you’re ready.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              router.push("/sign-in");
              router.refresh();
            }}
          >
            Sign in <ArrowRight size={16} />
          </Button>
        </div>
      </AuthScaffold>
    );
  }

  // Link arrived without a valid token.
  if (!token || linkError) {
    return (
      <AuthScaffold
        title="This link didn’t work"
        subtitle="It may have expired or already been used. Request a fresh reset link."
        back={{ href: "/sign-in", label: "Back to sign in" }}
      >
        <Button href="/forgot-password" className="w-full">
          Request a new link <ArrowRight size={16} />
        </Button>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Choose a new password"
      subtitle="Pick something at least 8 characters long."
      back={{ href: "/sign-in", label: "Back to sign in" }}
      footer={
        <Link
          href="/sign-in"
          className="font-medium text-ink transition-colors hover:text-accent"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <PasswordInput
          value={password}
          onChange={(v) => {
            setPassword(v);
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
        <AuthError>{error}</AuthError>
        <Button type="submit" className="w-full" loading={pending}>
          Update password {!pending && <ArrowRight size={16} />}
        </Button>
      </form>
    </AuthScaffold>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
