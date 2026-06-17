"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { looksLikeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthScaffold, AuthError } from "@/components/auth/AuthScaffold";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email))
      return setError("Enter the email on your account.");
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t send the reset link."));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthScaffold
        title="Check your email"
        subtitle={
          <>
            If an account exists for{" "}
            <span className="font-medium text-ink">{email.trim()}</span>, a
            password-reset link is on its way.
          </>
        }
        back={{ href: "/sign-in", label: "Back to sign in" }}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck size={26} />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-slate">
            The link expires shortly. Open it to choose a new password.
          </p>
        </div>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Reset your password"
      subtitle="Enter your email and we’ll send a link to choose a new one."
      back={{ href: "/sign-in", label: "Back to sign in" }}
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-ink transition-colors hover:text-accent"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="you@example.com"
          leading={<Mail size={18} />}
          aria-label="Email address"
          autoComplete="email"
        />
        <AuthError>{error}</AuthError>
        <Button type="submit" className="w-full" loading={pending}>
          Send reset link {!pending && <ArrowRight size={16} />}
        </Button>
      </form>
    </AuthScaffold>
  );
}
