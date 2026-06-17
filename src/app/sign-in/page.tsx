"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Mail } from "lucide-react";
import { looksLikeEmail } from "@/lib/auth-helpers";
import { Wordmark } from "@/components/brand/WheelLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-porcelain">
      <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} /> Back
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Wordmark size={32} textClassName="text-lg" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
              Welcome to UniKart
            </h1>
            <p className="mt-1.5 text-sm text-slate">
              Sign in to save products and pick up where you left off.
            </p>
          </div>

          <div className="glass-strong rounded-3xl p-6">
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
              {error && <p className="pl-2 text-xs text-up">{error}</p>}
              <Button type="submit" className="w-full">
                Continue <ArrowRight size={16} />
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-silver">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/demo")}
            >
              Explore the demo
            </Button>

            <p className="mt-5 text-center text-xs leading-relaxed text-silver">
              This is a preview build — continuing takes you straight to your Hub.
              Email & passkey sign-in arrive with saved accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
