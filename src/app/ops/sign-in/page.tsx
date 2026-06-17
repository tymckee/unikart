"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { looksLikeEmail } from "@/lib/utils";
import { WheelLogo } from "@/components/brand/WheelLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AltMethods } from "@/components/auth/AltMethods";

type Pending = "password" | "magic" | "passkey" | null;

function OpsSignInInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [magicSent, setMagicSent] = useState(false);

  const clearError = () => error && setError(null);

  function done() {
    // The console layout re-checks role; if this account isn't an operator it
    // will land on Access Denied (logged) rather than the dashboard.
    router.push("/ops");
    router.refresh();
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter a valid email to continue.");
    if (!password) return setError("Enter your password.");
    setPending("password");
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setPending(null);
    if (error) return setError(friendlyAuthError(error, "We couldn’t sign you in."));
    done();
  }

  async function handleMagicLink() {
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter your email to get a sign-in link.");
    setPending("magic");
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: "/ops",
    });
    setPending(null);
    if (error) return setError(friendlyAuthError(error, "We couldn’t send your link."));
    setMagicSent(true);
  }

  async function handlePasskey() {
    setError(null);
    setPending("passkey");
    const res = await authClient.signIn.passkey();
    setPending(null);
    if (res?.error)
      return setError(friendlyAuthError(res.error, "We couldn’t find a passkey on this device."));
    done();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-porcelain px-4 py-10">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <WheelLogo size={36} className="text-ink" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-ink">
            Uni<span className="text-slate">Kart</span> Ops
          </span>
          <Pill tone="ink" size="sm">
            Internal
          </Pill>
        </div>
        <p className="max-w-xs text-sm text-slate text-pretty">
          Operator sign-in. Access is limited to authorized UniKart staff.
        </p>
      </div>

      <GlassCard className="w-full max-w-sm p-6 sm:p-7">
        {magicSent ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <MailCheck size={26} />
            </span>
            <p className="text-sm font-medium text-ink">Check your email</p>
            <p className="text-pretty text-sm text-slate">
              We sent a sign-in link to{" "}
              <span className="font-medium text-ink">{email.trim()}</span>. It works
              once and expires shortly.
            </p>
            <button
              type="button"
              onClick={() => setMagicSent(false)}
              className="text-xs font-medium text-accent transition-colors hover:text-accent-ink"
            >
              Use a different method
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handlePassword} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                placeholder="you@uni-kart.com"
                leading={<Mail size={18} />}
                aria-label="Work email"
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
              {error && <p className="text-sm text-up">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                loading={pending === "password"}
                disabled={pending !== null && pending !== "password"}
              >
                Sign in {pending !== "password" && <ArrowRight size={16} />}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-silver">
              <span className="h-px flex-1 bg-line" /> or
              <span className="h-px flex-1 bg-line" />
            </div>

            <AltMethods
              onMagicLink={handleMagicLink}
              onPasskey={handlePasskey}
              passkeyLabel="Sign in with Face ID / Touch ID"
              magicLoading={pending === "magic"}
              passkeyLoading={pending === "passkey"}
              disabled={pending === "password"}
            />
          </>
        )}
      </GlassCard>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-silver">
        <Lock size={12} /> Activity in UniKart Ops is audited.
      </p>
      <Link
        href="/"
        className="mt-2 text-xs text-slate transition-colors hover:text-ink"
      >
        Back to uni-kart.com
      </Link>
    </main>
  );
}

export default function OpsSignInPage() {
  return (
    <Suspense fallback={null}>
      <OpsSignInInner />
    </Suspense>
  );
}
