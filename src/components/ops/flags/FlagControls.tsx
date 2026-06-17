"use client";

/**
 * UniKart Ops — feature flag controls (per-flag card body).
 *
 * Receives one flag plus the bound server actions from the server page and
 * renders the interactive controls: an enabled toggle (confirm-gated), a rollout
 * percentage editor, and allow / deny list editors. The maintenance_mode kill
 * switch gets distinct, calm emergency framing and a firmer confirmation.
 *
 * When `canMutate` is false everything renders read-only — the same information,
 * no controls. The server actions re-check the permission regardless (defence in
 * depth), so hiding controls is purely a UX nicety.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsConfirmDialog } from "@/components/ops/OpsConfirmDialog";
import { useOpsToast } from "@/components/ops/OpsToast";
import type { OpsActionResult } from "@/lib/ops/types";
import type { FeatureFlagView } from "@/lib/ops/data/feature-flags";

interface FlagActions {
  toggle: (key: string, enabled: boolean) => Promise<OpsActionResult>;
  setRollout: (key: string, percent: number) => Promise<OpsActionResult>;
  setAllowlist: (key: string, emails: string[]) => Promise<OpsActionResult>;
  setDenylist: (key: string, emails: string[]) => Promise<OpsActionResult>;
}

interface FlagControlsProps {
  flag: FeatureFlagView;
  canMutate: boolean;
  actions: FlagActions;
}

export function FlagControls({ flag, canMutate, actions }: FlagControlsProps) {
  const isKill = flag.isMaintenance;

  return (
    <GlassCard
      className={
        "overflow-hidden " +
        (isKill ? "border-2 border-warn/50" : "")
      }
    >
      {/* Header: name, key, status, and (for maintenance) the kill-switch banner. */}
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isKill && (
                <span className="inline-flex text-warn" aria-hidden="true">
                  <ShieldAlert size={16} />
                </span>
              )}
              <h3 className="text-sm font-semibold tracking-tight text-ink">
                {flag.name}
              </h3>
              {isKill && <Pill tone="warn">Emergency kill switch</Pill>}
            </div>
            <code className="mt-1 block font-mono text-xs text-slate">{flag.key}</code>
          </div>
          <OpsStatusPill status={flag.enabled ? "enabled" : "disabled"} />
        </div>

        <p className="mt-2 max-w-prose text-sm text-slate text-pretty">
          {flag.description || "No description."}
        </p>

        {isKill && (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn text-pretty">
            Turning this on shows everyone a calm maintenance notice in place of
            the app. Use it only during an incident, and turn it off as soon as
            service is restored.
          </p>
        )}
      </div>

      {/* Toggle row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-medium text-ink">
            {flag.enabled ? "On" : "Off"}
          </p>
          <p className="mt-0.5 text-xs text-slate">
            {isKill
              ? "Master switch for maintenance mode."
              : "Whether this feature is available."}
          </p>
        </div>
        {canMutate ? (
          <OpsConfirmDialog
            title={
              isKill
                ? flag.enabled
                  ? "Turn off maintenance mode"
                  : "Turn on maintenance mode"
                : flag.enabled
                  ? "Turn off " + flag.name
                  : "Turn on " + flag.name
            }
            description={
              isKill
                ? flag.enabled
                  ? "This restores normal access for everyone. The change is recorded in the audit log."
                  : "This shows everyone a maintenance notice in place of the app. The change is recorded in the audit log."
                : "This change takes effect immediately and is recorded in the audit log."
            }
            confirmLabel={
              isKill
                ? flag.enabled
                  ? "Turn off"
                  : "Turn on maintenance mode"
                : flag.enabled
                  ? "Turn off"
                  : "Turn on"
            }
            danger={isKill && !flag.enabled}
            action={() => actions.toggle(flag.key, !flag.enabled)}
            successMessage="Flag updated."
            trigger={(open) => (
              <Button
                variant={flag.enabled ? "secondary" : isKill ? "danger" : "primary"}
                size="sm"
                onClick={open}
              >
                {flag.enabled ? "Turn off" : "Turn on"}
              </Button>
            )}
          />
        ) : (
          <span className="text-xs text-silver">Read-only</span>
        )}
      </div>

      {/* Rollout */}
      <RolloutEditor flag={flag} canMutate={canMutate} setRollout={actions.setRollout} />

      {/* Allow / deny lists */}
      <ListEditor
        flag={flag}
        kind="allowlist"
        canMutate={canMutate}
        setList={actions.setAllowlist}
      />
      <ListEditor
        flag={flag}
        kind="denylist"
        canMutate={canMutate}
        setList={actions.setDenylist}
      />
    </GlassCard>
  );
}

/* ---------------------------------------------------------------- rollout --- */

function RolloutEditor({
  flag,
  canMutate,
  setRollout,
}: {
  flag: FeatureFlagView;
  canMutate: boolean;
  setRollout: (key: string, percent: number) => Promise<OpsActionResult>;
}) {
  const [value, setValue] = useState(flag.rolloutPercent);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  const dirty = value !== flag.rolloutPercent;
  const valid = Number.isFinite(value) && value >= 0 && value <= 100;

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        const result = await setRollout(flag.key, value);
        if (result.ok) {
          toast.success(result.message ?? "Rollout updated.");
          router.refresh();
        } else {
          toast.error(result.message ?? "Couldn't update the rollout.");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="border-b border-line px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Rollout</p>
        <span className="text-sm tabular-nums text-slate">{flag.rolloutPercent}%</span>
      </div>
      <p className="mt-0.5 text-xs text-slate text-pretty">
        Share of eligible users this is enabled for, on top of the allowlist.
      </p>

      {canMutate ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            aria-label={"Rollout percentage for " + flag.name}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-1.5 min-w-40 flex-1 cursor-pointer appearance-none rounded-full bg-canvas accent-accent"
          />
          <div className="flex h-9 w-24 items-center gap-1 rounded-full border border-line bg-white px-3 shadow-soft transition-colors focus-within:border-accent/60">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              aria-label={"Rollout percent for " + flag.name}
              value={value}
              onChange={(e) => {
                const n = Number(e.target.value);
                setValue(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
              }}
              className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-ink focus:outline-none"
            />
            <span className="text-xs text-silver">%</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={!dirty || !valid}
            loading={pending}
          >
            Save
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setValue(flag.rolloutPercent)}
              disabled={pending}
            >
              Reset
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: flag.rolloutPercent + "%" }}
            role="img"
            aria-label={flag.rolloutPercent + " percent rollout"}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- allow / deny lists --- */

function ListEditor({
  flag,
  kind,
  canMutate,
  setList,
}: {
  flag: FeatureFlagView;
  kind: "allowlist" | "denylist";
  canMutate: boolean;
  setList: (key: string, emails: string[]) => Promise<OpsActionResult>;
}) {
  const current = kind === "allowlist" ? flag.allowlist : flag.denylist;
  const title = kind === "allowlist" ? "Allowlist" : "Denylist";
  const help =
    kind === "allowlist"
      ? "Always on for these emails, regardless of rollout."
      : "Always off for these emails, regardless of rollout.";
  const tone = kind === "allowlist" ? "down" : "up";

  const [text, setText] = useState(current.join("\n"));
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  const parsed = useMemo(() => parseEntries(text), [text]);
  const dirty = useMemo(
    () => !sameList(parsed, current),
    [parsed, current],
  );

  function save() {
    startTransition(async () => {
      try {
        const result = await setList(flag.key, parsed);
        if (result.ok) {
          toast.success(result.message ?? title + " updated.");
          router.refresh();
        } else {
          toast.error(result.message ?? "Couldn't update the " + kind + ".");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="px-5 py-4 last:rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{title}</p>
        <Pill tone={tone as "down" | "up"}>
          {current.length} {current.length === 1 ? "entry" : "entries"}
        </Pill>
      </div>
      <p className="mt-0.5 text-xs text-slate text-pretty">{help}</p>

      {canMutate ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="One email per line"
            aria-label={title + " for " + flag.name + " — one email per line"}
            className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs text-ink outline-none transition-colors placeholder:text-silver focus:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setText(current.join("\n"))}
                disabled={pending}
              >
                Reset
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={save}
              disabled={!dirty}
              loading={pending}
            >
              Save {title.toLowerCase()}
            </Button>
          </div>
        </div>
      ) : current.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {current.map((entry) => (
            <li key={entry}>
              <Pill tone="outline" className="font-mono">
                {entry}
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-silver">None.</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- helpers --- */

/** Split a textarea value into trimmed, de-duplicated entries (split on lines/commas). */
function parseEntries(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Compare two entry lists case-insensitively, order-independent. */
function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map((x) => x.toLowerCase()));
  return a.every((x) => setB.has(x.toLowerCase()));
}
