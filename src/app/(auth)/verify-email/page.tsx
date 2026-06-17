"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail } from "lucide-react";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { AuthScaffold, AuthError } from "@/components/auth/AuthScaffold";

/**
 * Landing for the email-confirmation link. Better Auth processes the token at
 * /api/auth/verify-email and (with autoSignInAfterVerification) redirects here.
 * So by the time we render, the happy path already has a live session — we
 * confirm and route into the Hub. If the token was bad/expired, Better Auth
 * sends ?error=…; we show a calm retry with a resend option.
 */
function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const verified = !isPending && !!session?.user && !errorCode;

  // Once we confirm a verified session, drift gently into the app.
  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1400);
    return () => clearTimeout(t);
  }, [verified, router]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setResendError(null);
    if (!email.trim()) return setResendError("Enter your email.");
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email: email.trim(),
      callbackURL: "/verify-email?welcome=1",
    });
    setResending(false);
    if (error) {
      setResendError(friendlyAuthError(error, "We couldn’t resend the link."));
      return;
    }
    setResent(true);
  }

  // Still resolving the session after the redirect.
  if (isPending && !errorCode) {
    return (
      <AuthScaffold title="Confirming your email" back={null}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <WheelSpinner size={26} />
          <p className="text-sm text-slate">One calm moment…</p>
        </div>
      </AuthScaffold>
    );
  }

  // Happy path — verified + signed in.
  if (verified) {
    return (
      <AuthScaffold
        title="You’re all set"
        subtitle={
          <>
            Your email is confirmed
            {session?.user?.email ? (
              <>
                {" "}
                — welcome,{" "}
                <span className="font-medium text-ink">
                  {session.user.name || session.user.email}
                </span>
              </>
            ) : null}
            .
          </>
        }
        back={null}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-down-soft text-down">
            <CircleCheck size={26} />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-slate">
            Taking you to your Hub…
          </p>
          <Button href="/dashboard" className="w-full">
            Open UniKart <ArrowRight size={16} />
          </Button>
        </div>
      </AuthScaffold>
    );
  }

  // Bad / expired token, or no session — offer a calm resend.
  if (resent) {
    return (
      <AuthScaffold
        title="Link on its way"
        subtitle={
          <>
            We sent a fresh confirmation link to{" "}
            <span className="font-medium text-ink">{email.trim()}</span>.
          </>
        }
        back={{ href: "/sign-in", label: "Back to sign in" }}
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center text-sm text-slate">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Mail size={26} />
          </span>
          Open it to finish confirming your account.
        </div>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="This link didn’t work"
      subtitle="It may have expired or already been used. Enter your email and we’ll send a fresh one."
      back={{ href: "/sign-in", label: "Back to sign in" }}
    >
      <form onSubmit={resend} className="space-y-3">
        {errorCode && (
          <div className="flex items-start gap-2 rounded-2xl bg-warn-soft px-3.5 py-3 text-xs text-warn">
            <TriangleAlert size={15} className="mt-px shrink-0" />
            <span>{friendlyAuthError({ code: errorCode })}</span>
          </div>
        )}
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (resendError) setResendError(null);
          }}
          placeholder="you@example.com"
          leading={<Mail size={18} />}
          aria-label="Email address"
          autoComplete="email"
        />
        <AuthError>{resendError}</AuthError>
        <Button type="submit" className="w-full" loading={resending}>
          Send a new link {!resending && <ArrowRight size={16} />}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate">
        Remembered everything?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-ink transition-colors hover:text-accent"
        >
          Sign in
        </Link>
      </p>
    </AuthScaffold>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthScaffold title="Confirming your email" back={null}>
          <div className="flex justify-center py-4">
            <WheelSpinner size={26} />
          </div>
        </AuthScaffold>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
