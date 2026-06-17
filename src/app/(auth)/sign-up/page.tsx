"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailCheck, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { looksLikeEmail } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail } from "lucide-react";
import {
  AuthScaffold,
  AuthDivider,
  AuthError,
} from "@/components/auth/AuthScaffold";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AltMethods } from "@/components/auth/AltMethods";

type Pending = "password" | "magic" | "passkey" | null;

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  // After a successful email+password sign-up we show the "check your email"
  // confirmation rather than navigating — the user must verify first.
  const [sent, setSent] = useState(false);

  const clearError = () => error && setError(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please add your name.");
    if (!looksLikeEmail(email)) return setError("Enter a valid email to continue.");
    if (password.length < 8)
      return setError("Use at least 8 characters for your password.");

    setPending("password");
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      // After they click the confirmation link, Better Auth verifies + signs
      // them in (autoSignInAfterVerification) and lands here — a calm welcome
      // that routes into the Hub.
      callbackURL: "/verify-email?welcome=1",
    });
    setPending(null);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t create your account."));
      return;
    }
    // requireEmailVerification + sendOnSignUp means a confirmation link is on
    // its way; there's no active session yet. Show the calm confirm state.
    setSent(true);
  }

  async function handleMagicLink() {
    setError(null);
    if (!looksLikeEmail(email))
      return setError("Enter your email to get a magic link.");
    setPending("magic");
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      name: name.trim() || undefined,
      callbackURL: "/dashboard",
    });
    setPending(null);
    if (error) {
      setError(friendlyAuthError(error, "We couldn’t send your link."));
      return;
    }
    setSent(true);
  }

  async function handlePasskey() {
    setError(null);
    setPending("passkey");
    // Passkey sign-up requires an authenticated user (you add a passkey from
    // Settings). At the door, this signs in with an existing passkey instead.
    const res = await authClient.signIn.passkey();
    setPending(null);
    if (res?.error) {
      setError(
        friendlyAuthError(
          res.error,
          "No passkey found. Create your account first, then add one in Settings.",
        ),
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (sent) {
    return (
      <AuthScaffold
        title="Check your email"
        subtitle={
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-ink">{email.trim()}</span>. Open it
            to finish setting up your UniKart.
          </>
        }
        back={{ href: "/sign-in", label: "Back to sign in" }}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck size={26} />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-slate">
            The link expires shortly, so it stays just for you. You can close
            this tab — once you confirm, you’ll land right in your Hub.
          </p>
          <p className="text-xs text-silver">
            Didn’t get it? Check spam, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-accent transition-colors hover:text-accent-ink"
            >
              try again
            </button>
            .
          </p>
        </div>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Create your UniKart"
      subtitle="One calm cart for everything you want to buy."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-ink transition-colors hover:text-accent"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignUp} className="space-y-3">
        <Input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError();
          }}
          placeholder="Your name"
          leading={<User size={18} />}
          aria-label="Your name"
          autoComplete="name"
        />
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
          placeholder="Create a password"
          autoComplete="new-password"
          ariaLabel="Create a password"
        />
        <AuthError>{error}</AuthError>
        <Button
          type="submit"
          className="w-full"
          loading={pending === "password"}
          disabled={pending !== null && pending !== "password"}
        >
          Create account {pending !== "password" && <ArrowRight size={16} />}
        </Button>
      </form>

      <AuthDivider />

      <AltMethods
        onMagicLink={handleMagicLink}
        onPasskey={handlePasskey}
        magicLoading={pending === "magic"}
        passkeyLoading={pending === "passkey"}
        disabled={pending === "password"}
      />

      <p className="mt-5 text-center text-xs leading-relaxed text-silver">
        By continuing you agree to keep things calm. We’ll email you a link to
        confirm your address.
      </p>
    </AuthScaffold>
  );
}
