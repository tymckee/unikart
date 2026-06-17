"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Mail, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { looksLikeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  AuthScaffold,
  AuthDivider,
  AuthError,
} from "@/components/auth/AuthScaffold";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AltMethods } from "@/components/auth/AltMethods";

type Pending = "password" | "magic" | "passkey" | null;

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Where to land after sign-in (e.g. ?next=/cart). Default to the Hub.
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [magicSent, setMagicSent] = useState(false);

  const clearError = () => error && setError(null);

  function done() {
    router.push(next);
    router.refresh();
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter a valid email to continue.");
    if (!password) return setError("Enter your password.");

    setPending("password");
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setPending(null);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t sign you in."));
      return;
    }
    done();
  }

  async function handleMagicLink() {
    setError(null);
    if (!looksLikeEmail(email))
      return setError("Enter your email to get a magic link.");
    setPending("magic");
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: next,
    });
    setPending(null);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t send your link."));
      return;
    }
    setMagicSent(true);
  }

  async function handlePasskey() {
    setError(null);
    setPending("passkey");
    const res = await authClient.signIn.passkey();
    setPending(null);
    if (res?.error) {
      setError(
        friendlyAuthError(
          res.error,
          "We couldn’t find a passkey on this device.",
        ),
      );
      return;
    }
    done();
  }

  if (magicSent) {
    return (
      <AuthScaffold
        title="Check your email"
        subtitle={
          <>
            We sent a sign-in link to{" "}
            <span className="font-medium text-ink">{email.trim()}</span>. Open it
            on this device to continue.
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck size={26} />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-slate">
            The link works once and expires shortly. You can close this tab.
          </p>
          <button
            type="button"
            onClick={() => setMagicSent(false)}
            className="text-xs font-medium text-accent transition-colors hover:text-accent-ink"
          >
            Use a different method
          </button>
        </div>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in to pick up right where you left off."
      footer={
        <>
          New to UniKart?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-ink transition-colors hover:text-accent"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handlePassword} className="space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          placeholder="you@example.com"
          leading={<Mail size={18} />}
          aria-label="Email address"
          autoComplete="email"
        />
        <PasswordInput
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError();
          }}
          placeholder="Password"
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="pr-1 text-xs font-medium text-slate transition-colors hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>
        <AuthError>{error}</AuthError>
        <Button
          type="submit"
          className="w-full"
          loading={pending === "password"}
          disabled={pending !== null && pending !== "password"}
        >
          Sign in {pending !== "password" && <ArrowRight size={16} />}
        </Button>
      </form>

      <AuthDivider />

      <AltMethods
        onMagicLink={handleMagicLink}
        onPasskey={handlePasskey}
        passkeyLabel="Sign in with Face ID / Touch ID"
        magicLoading={pending === "magic"}
        passkeyLoading={pending === "passkey"}
        disabled={pending === "password"}
      />
    </AuthScaffold>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
