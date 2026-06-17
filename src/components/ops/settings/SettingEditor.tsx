"use client";

/**
 * UniKart Ops — inline editor for a single non-secret SystemSetting.
 *
 * Renders one scalar setting (string / number / boolean) with a calm inline
 * control. Saving runs the updateSetting server action and surfaces the result
 * via a toast; the page revalidates server-side. Read-only operators (no
 * settings.mutate) see the value rendered plainly, with no controls.
 *
 * This component is value-only — it never touches secrets. Structured config is
 * shown read-only by the page and edited elsewhere, so it never reaches here.
 */
import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useOpsToast } from "@/components/ops/OpsToast";
import { dateTime } from "@/lib/ops/format";
import type { OpsActionResult } from "@/lib/ops/types";

type Scalar = string | number | boolean;

interface SettingEditorProps {
  settingKey: string;
  description: string;
  /** Current scalar value (string / number / boolean). */
  value: Scalar;
  updatedAt: string;
  canEdit: boolean;
  /** Bound server action: (key, value) => result. Passed from the server page. */
  updateAction: (key: string, value: unknown) => Promise<OpsActionResult>;
}

function valueKind(value: Scalar): "string" | "number" | "boolean" {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export function SettingEditor({
  settingKey,
  description,
  value,
  updatedAt,
  canEdit,
  updateAction,
}: SettingEditorProps) {
  const kind = valueKind(value);
  const [draft, setDraft] = useState<Scalar>(value);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();

  // Dirty when the draft differs from the persisted value.
  const dirty = draft !== value;

  const numberInvalid =
    kind === "number" && (draft === "" || !Number.isFinite(Number(draft)));

  function save() {
    if (kind === "number" && numberInvalid) return;
    const payload: Scalar = kind === "number" ? Number(draft) : draft;
    startTransition(async () => {
      const result = await updateAction(settingKey, payload);
      if (result.ok) {
        toast.success(result.message ?? "Setting saved.");
      } else {
        toast.error(result.message ?? "Couldn't save the setting.");
        setDraft(value);
      }
    });
  }

  function reset() {
    setDraft(value);
  }

  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[0.8125rem] text-ink">{settingKey}</code>
          <Pill tone="outline">{kind}</Pill>
        </div>
        {description && (
          <p className="mt-1 max-w-prose text-xs text-slate text-pretty">{description}</p>
        )}
        <p className="mt-1 text-[0.6875rem] text-silver">
          Updated {dateTime(updatedAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Boolean → calm toggle. */}
        {kind === "boolean" && (
          <ToggleControl
            checked={draft === true}
            disabled={!canEdit || pending}
            ariaLabel={"Toggle " + settingKey}
            onChange={(next) => setDraft(next)}
          />
        )}

        {/* Number → numeric input. */}
        {kind === "number" && (
          <div
            className={
              "flex h-9 w-36 items-center rounded-full border bg-white px-3 shadow-soft transition-colors focus-within:border-accent/60 " +
              (numberInvalid ? "border-up" : dirty ? "border-accent/60" : "border-line")
            }
          >
            <input
              type="number"
              inputMode="decimal"
              aria-label={"Value for " + settingKey}
              value={String(draft)}
              disabled={!canEdit || pending}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-ink focus:outline-none disabled:opacity-60"
            />
          </div>
        )}

        {/* String → text input. */}
        {kind === "string" && (
          <div
            className={
              "flex h-9 w-56 items-center rounded-full border bg-white px-3 shadow-soft transition-colors focus-within:border-accent/60 " +
              (dirty ? "border-accent/60" : "border-line")
            }
          >
            <input
              type="text"
              aria-label={"Value for " + settingKey}
              value={String(draft)}
              disabled={!canEdit || pending}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none disabled:opacity-60"
            />
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-1">
            {dirty && (
              <Button
                variant="ghost"
                size="icon"
                onClick={reset}
                disabled={pending}
                aria-label="Reset"
                className="h-9 w-9"
              >
                <RotateCcw size={15} />
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              loading={pending}
              disabled={!dirty || numberInvalid}
            >
              {!pending && <Check size={15} />}
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A calm, accessible on/off switch (no bounce, honors disabled state). */
function ToggleControl({
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 " +
        (checked ? "border-accent bg-accent" : "border-line bg-canvas")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-soft transition-transform duration-200 ease-out " +
          (checked ? "translate-x-5" : "translate-x-1")
        }
      />
    </button>
  );
}
