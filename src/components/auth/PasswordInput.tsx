"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";

/**
 * Password field matching the UniKart Input — leading lock, trailing show/hide
 * toggle. Thin wrapper so every auth screen handles passwords identically.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  ariaLabel = "Password",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  ariaLabel?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      id={id}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      leading={<Lock size={18} />}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-silver transition-colors hover:text-slate"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}
