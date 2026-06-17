import { Mail, ShieldCheck, Users, KeyRound, Lock, Settings2 } from "lucide-react";
import Link from "next/link";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { SettingEditor } from "@/components/ops/settings/SettingEditor";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { getSettings, getAdminTeam, type AdminTeamMember } from "@/lib/ops/data/settings";
import { updateSetting } from "@/lib/ops/actions/settings";
import { getOpsViewer } from "@/lib/ops/viewer";
import {
  can,
  permissionsFor,
  ROLE_META,
  OPS_ROLES,
  type Role,
} from "@/lib/ops/permissions";
import { adminEmails } from "@/lib/ops/env";
import { dateTime, shortDate } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

/** Permission groups shown in the role x permission matrix (compact, informational). */
const PERMISSION_GROUPS: { label: string; sample: Parameters<typeof can>[1] }[] = [
  { label: "Overview", sample: "overview.read" },
  { label: "Users", sample: "users.mutate" },
  { label: "Products", sample: "products.mutate" },
  { label: "Parser", sample: "parser.retry" },
  { label: "Billing", sample: "billing.refund" },
  { label: "Costs", sample: "costs.mutate" },
  { label: "Flags", sample: "featureFlags.mutate" },
  { label: "Settings", sample: "settings.mutate" },
  { label: "Team", sample: "team.mutate" },
];

export default async function SettingsPage() {
  const viewer = await getOpsViewer();
  const canViewTeam = can(viewer, "team.read");
  const canEditSettings = can(viewer, "settings.mutate");

  const [groups, team] = await Promise.all([getSettings(), getAdminTeam()]);
  const allowlist = Array.from(adminEmails()).sort();

  return (
    <>
      <OpsPageHeader
        title="Settings"
        description="Who has access to UniKart Ops, how roles map to permissions, and the non-secret configuration that shapes the product. Secrets are never shown or stored here."
      />

      {/* Secrets note — explicit and calm, restated near anything editable below. */}
      <GlassCard className="mb-8 flex flex-wrap items-center gap-3 px-5 py-4">
        <Pill tone="neutral" icon={<Lock size={13} />}>
          Secrets
        </Pill>
        <p className="min-w-0 flex-1 text-sm text-slate text-pretty">
          API keys, tokens, and other secrets live in environment variables. They are
          never shown or stored here, and nothing on this page can read them.
        </p>
      </GlassCard>

      {/* Admin team */}
      {canViewTeam ? (
        <AdminTeamSection team={team} />
      ) : (
        <OpsSection title="Admin team" description="Who can access UniKart Ops.">
          <OpsEmptyState
            title="Not visible to your role"
            description="Viewing the admin team needs the team.read permission."
            icon={<Users size={20} />}
          />
        </OpsSection>
      )}

      {/* Allowed emails (ADMIN_EMAILS) */}
      <OpsSection
        title="Allowed emails"
        description="The seed-admin allowlist. Set via the ADMIN_EMAILS environment variable — read-only here, never stored in the database."
      >
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate">
            <Mail size={14} />
            <span>
              An allowlisted email that hasn&apos;t been given a role yet is seeded as
              Owner on first sign-in.
            </span>
          </div>
          {allowlist.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {allowlist.map((email) => (
                <li key={email}>
                  <Pill tone="outline" className="font-mono">
                    {email}
                  </Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate">
              No seed admins are configured. Set ADMIN_EMAILS to seed the first Owner.
            </p>
          )}
          <p className="mt-4 text-xs text-silver">
            To change this list, update the ADMIN_EMAILS environment variable and
            redeploy. It is intentionally not editable from the console.
          </p>
        </GlassCard>
      </OpsSection>

      {/* Roles & permissions */}
      <RolesSection />

      {/* System settings */}
      <OpsSection
        title="System settings"
        description="Non-secret configuration, grouped by area. Scalar values can be edited inline; structured config is shown read-only and edited on its own page."
      >
        {groups.length > 0 ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <GlassCard key={group.category} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
                      <Settings2 size={15} className="text-slate" />
                      {group.label}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate">{group.description}</p>
                  </div>
                </div>
                <div className="divide-y divide-line px-5">
                  {group.settings.map((setting) =>
                    setting.editable ? (
                      <SettingEditor
                        key={setting.key}
                        settingKey={setting.key}
                        description={setting.description}
                        value={setting.value as string | number | boolean}
                        updatedAt={setting.updatedAt}
                        canEdit={canEditSettings}
                        updateAction={updateSetting}
                      />
                    ) : (
                      <ReadOnlySetting
                        key={setting.key}
                        settingKey={setting.key}
                        description={setting.description}
                        valueJson={setting.valueJson}
                        updatedAt={setting.updatedAt}
                      />
                    ),
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <OpsEmptyState
            title="No settings yet"
            description="System settings appear here once the SystemSetting table is seeded."
            icon={<Settings2 size={20} />}
          />
        )}
      </OpsSection>
    </>
  );
}

/* ---- Admin team ---- */

function AdminTeamSection({ team }: { team: AdminTeamMember[] }) {
  const columns: OpsColumn<AdminTeamMember>[] = [
    {
      key: "email",
      header: "Member",
      render: (m) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{m.name || "—"}</div>
          <div className="truncate font-mono text-xs text-slate">{m.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => <Pill tone="accent">{ROLE_META[m.role].label}</Pill>,
    },
    {
      key: "internal",
      header: "Type",
      render: (m) =>
        m.isInternal ? (
          <Pill tone="outline">Internal</Pill>
        ) : (
          <span className="text-xs text-silver">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <OpsStatusPill status={m.status} />,
    },
    {
      key: "lastActiveAt",
      header: "Last active",
      align: "right",
      render: (m) => (
        <span className="tabular-nums text-slate">{shortDate(m.lastActiveAt)}</span>
      ),
    },
  ];

  return (
    <OpsSection
      title="Admin team"
      description="Everyone with an Ops role. Role changes are made on a member's user page — open a member to change their role."
    >
      <OpsDataTable
        columns={columns}
        rows={team}
        getRowKey={(m) => m.id}
        rowHref={(m) => "/ops/users/" + m.id}
        empty={
          <OpsEmptyState
            title="No admin team yet"
            description="Operators appear here once a user is given an Ops role."
            icon={<ShieldCheck size={20} />}
          />
        }
      />
    </OpsSection>
  );
}

/* ---- Roles & permissions ---- */

function RolesSection() {
  const roles: Role[] = OPS_ROLES;

  return (
    <OpsSection
      title="Roles & permissions"
      description="How each Ops role maps to what it can do. This is informational — role assignments are managed per user."
    >
      <div className="space-y-4">
        {/* Role descriptions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <GlassCard key={role} className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck size={15} className="text-slate" />
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  {ROLE_META[role].label}
                </h3>
              </div>
              <p className="text-xs text-slate text-pretty">
                {ROLE_META[role].description}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* Compact permission matrix: roles x permission groups */}
        <GlassCard className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
              <KeyRound size={15} className="text-slate" />
              Permission matrix
            </h3>
            <p className="mt-0.5 text-xs text-slate">
              A checkmark means the role can take an action in that area (mutations
              where applicable, otherwise read access).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-slate">
                  <th scope="col" className="px-5 py-2.5">
                    Area
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-center"
                    >
                      {ROLE_META[role].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <tr
                    key={group.label}
                    className="border-b border-line/70 last:border-0"
                  >
                    <th
                      scope="row"
                      className="whitespace-nowrap px-5 py-3 text-left font-medium text-ink"
                    >
                      {group.label}
                    </th>
                    {roles.map((role) => {
                      const granted = permissionsFor(role).has(group.sample);
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          {granted ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-down-soft text-down">
                              <ShieldCheck size={13} aria-hidden />
                              <span className="sr-only">Granted</span>
                            </span>
                          ) : (
                            <span className="text-silver" aria-label="Not granted">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </OpsSection>
  );
}

/* ---- Read-only (structured) setting ---- */

function ReadOnlySetting({
  settingKey,
  description,
  valueJson,
  updatedAt,
}: {
  settingKey: string;
  description: string;
  valueJson: string;
  updatedAt: string;
}) {
  // Pretty-print structured JSON; fall back to the raw string if it won't parse.
  let pretty = valueJson;
  try {
    pretty = JSON.stringify(JSON.parse(valueJson), null, 2);
  } catch {
    pretty = valueJson;
  }

  const isCostRates = settingKey === "cost.rates";

  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-[0.8125rem] text-ink">{settingKey}</code>
        <Pill tone="outline">structured</Pill>
        {isCostRates && (
          <Link
            href="/ops/costs"
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            Edit on the Costs page
          </Link>
        )}
      </div>
      {description && (
        <p className="mt-1 max-w-prose text-xs text-slate text-pretty">{description}</p>
      )}
      <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-line bg-canvas px-3 py-2 font-mono text-xs text-slate">
        {pretty}
      </pre>
      <p className="mt-1 text-[0.6875rem] text-silver">Updated {dateTime(updatedAt)}</p>
    </div>
  );
}
