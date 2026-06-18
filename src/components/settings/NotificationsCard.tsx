"use client";

import { useEffect, useMemo, useState } from "react";
import { updateNotificationPreferences } from "@/lib/actions";
import type { DigestFrequency, NotificationPreferences } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection, SettingsRow } from "./SettingsSection";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

/** A calm, hairline-styled native select — keeps the porcelain aesthetic while
 *  staying fully keyboard- and screen-reader-friendly. */
function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Notification preferences — real, persisted settings (replaces the old demo
 * toggles). Phase 0 is a calm email digest: a master switch, how often (daily
 * or weekly), and when. The browser's timezone is captured on mount so digests
 * arrive at the user's local hour. Web push and quiet hours arrive with their
 * own channels later.
 */
export function NotificationsCard({
  initialPrefs,
  onNotify,
}: {
  initialPrefs: NotificationPreferences;
  onNotify: (msg: string) => void;
}) {
  const [saved, setSaved] = useState<NotificationPreferences>(initialPrefs);
  const [form, setForm] = useState<NotificationPreferences>(initialPrefs);
  const [saving, setSaving] = useState(false);

  // Capture the real browser timezone so the daily/weekly digest fires at the
  // user's local hour rather than the stored default. When it differs from
  // what's stored we persist it quietly in the background (no "unsaved changes"
  // nag — that would sit against the calm brand), updating both snapshots so the
  // form stays clean. Converges after one visit, then no longer writes.
  useEffect(() => {
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = null; // Intl unavailable — keep the stored timezone.
    }
    if (!tz || tz === saved.timezone) return;
    const next = tz;
    let cancelled = false;
    void (async () => {
      const res = await updateNotificationPreferences({ ...saved, timezone: next });
      if (cancelled || !res.ok) return;
      setSaved((s) => ({ ...s, timezone: next }));
      setForm((f) => ({ ...f, timezone: next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatHour(h) })),
    [],
  );
  const weekdayOptions = useMemo(
    () => WEEKDAYS.map((label, value) => ({ value, label })),
    [],
  );

  async function save() {
    setSaving(true);
    const res = await updateNotificationPreferences(form);
    setSaving(false);
    if (res.ok) {
      setSaved(form);
      onNotify("Notification preferences saved.");
    } else {
      onNotify("We couldn’t save that — please try again.");
    }
  }

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="A calm email summary of price and stock changes on the things you're watching. No pressure, on your schedule."
    >
      <SettingsRow
        label="Email updates"
        description="Get a quiet digest when prices or stock move."
        control={
          <Switch
            label="Email updates"
            checked={form.emailEnabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, emailEnabled: v }))}
          />
        }
      />

      {form.emailEnabled && (
        <>
          <SettingsRow
            label="How often"
            description="A single summary, daily or weekly."
            control={
              <SegmentedControl<DigestFrequency>
                size="sm"
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
                value={form.digestFrequency}
                onChange={(v) => setForm((f) => ({ ...f, digestFrequency: v }))}
              />
            }
          />

          {form.digestFrequency === "weekly" && (
            <SettingsRow
              label="Day"
              description="Which day your weekly summary arrives."
              control={
                <Select
                  ariaLabel="Day of week for the weekly digest"
                  value={form.digestWeekday}
                  onChange={(v) => setForm((f) => ({ ...f, digestWeekday: v }))}
                  options={weekdayOptions}
                />
              }
            />
          )}

          <SettingsRow
            label="Time"
            description={`Sent around this hour, your time (${form.timezone}).`}
            control={
              <Select
                ariaLabel="Time of day for the digest"
                value={form.digestSendHour}
                onChange={(v) => setForm((f) => ({ ...f, digestSendHour: v }))}
                options={hourOptions}
              />
            }
          />
        </>
      )}

      <div className="flex items-center justify-end gap-3 px-5 py-4">
        {dirty && <span className="text-xs text-slate">Unsaved changes</span>}
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </SettingsSection>
  );
}
