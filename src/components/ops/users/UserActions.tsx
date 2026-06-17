"use client";

/**
 * UserActions — the action surface on the user detail page.
 *
 * Receives the user + the viewer's permission booleans + the server actions as
 * props (a server page may pass server-action functions down to a client
 * component). Hides controls the role can't use (the server still re-checks +
 * audits every call). State-changing actions on another user capture a reason
 * via OpsReasonDialog; simple ones use OpsConfirmDialog.
 *
 * The shared dialogs own their open state and render their own trigger. To drive
 * several of them from one kebab menu, each menu-driven dialog renders a hidden
 * trigger button with a stable id; the menu item clicks it. (Avoids reading
 * refs during render and keeps each dialog self-contained.)
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Ban,
  CheckCircle2,
  RotateCcw,
  Download,
  Trash2,
  FlaskConical,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { OpsActionMenu } from "@/components/ops/OpsActionMenu";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import { OpsConfirmDialog } from "@/components/ops/OpsConfirmDialog";
import { useOpsToast } from "@/components/ops/OpsToast";
import { ROLES, ROLE_META, type Role } from "@/lib/ops/permissions";
import type { OpsActionResult } from "@/lib/ops/types";

export interface UserActionsProps {
  user: {
    id: string;
    name: string;
    role: string;
    status: string;
    isTestAccount: boolean;
    isInternal: boolean;
  };
  viewerRole: Role;
  perms: {
    note: boolean;
    role: boolean;
    disable: boolean;
    mutate: boolean;
  };
  actions: {
    changeRole: (userId: string, role: string, reason: string) => Promise<OpsActionResult>;
    disableUser: (userId: string, reason: string) => Promise<OpsActionResult>;
    enableUser: (userId: string, reason: string) => Promise<OpsActionResult>;
    resetOnboarding: (userId: string) => Promise<OpsActionResult>;
    requestDataExport: (userId: string) => Promise<OpsActionResult>;
    queueDataDeletion: (userId: string, reason: string) => Promise<OpsActionResult>;
    setTestAccount: (userId: string, value: boolean) => Promise<OpsActionResult>;
    setInternal: (userId: string, value: boolean) => Promise<OpsActionResult>;
  };
}

/** Click a hidden dialog trigger by id (the dialog handles its own open state). */
function clickTrigger(id: string) {
  if (typeof document !== "undefined") {
    document.getElementById(id)?.click();
  }
}

export function UserActions({ user, viewerRole, perms, actions }: UserActionsProps) {
  const router = useRouter();
  const toast = useOpsToast();
  const [, startTransition] = useTransition();

  // Role selection inside the role dialog.
  const [selectedRole, setSelectedRole] = useState<string>(user.role);

  const isOwnerTarget = user.role === "OWNER";
  const viewerIsOwner = viewerRole === "OWNER";
  const isDisabled = user.status === "disabled";
  const roleLocked = isOwnerTarget && !viewerIsOwner;

  // Stable trigger ids, scoped per user.
  const tid = (key: string) => "user-action-" + key + "-" + user.id;

  // Toggle a boolean flag (test/internal) directly — no reason needed.
  function runToggle(fn: () => Promise<OpsActionResult>) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          toast.success(res.message ?? "Done.");
          router.refresh();
        } else {
          toast.error(res.message ?? "That didn't work. Please try again.");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  // Roles the viewer may assign. Non-owners can never grant OWNER.
  const assignableRoles = ROLES.filter((r) => !(r === "OWNER" && !viewerIsOwner));

  const menuItems = [
    perms.role && {
      label: "Change role",
      icon: <ShieldCheck size={16} />,
      onSelect: () => {
        setSelectedRole(user.role);
        clickTrigger(tid("role"));
      },
      disabled: roleLocked,
    },
    perms.disable &&
      !isDisabled && {
        label: "Disable account",
        icon: <Ban size={16} />,
        danger: true,
        onSelect: () => clickTrigger(tid("disable")),
        disabled: isOwnerTarget && !viewerIsOwner,
      },
    perms.disable &&
      isDisabled && {
        label: "Re-enable account",
        icon: <CheckCircle2 size={16} />,
        onSelect: () => clickTrigger(tid("enable")),
      },
    perms.mutate && {
      label: "Reset onboarding",
      icon: <RotateCcw size={16} />,
      onSelect: () => clickTrigger(tid("reset")),
    },
    perms.mutate && {
      label: user.isTestAccount ? "Clear test flag" : "Mark as test account",
      icon: <FlaskConical size={16} />,
      onSelect: () => runToggle(() => actions.setTestAccount(user.id, !user.isTestAccount)),
    },
    perms.mutate && {
      label: user.isInternal ? "Clear internal flag" : "Mark as internal",
      icon: <Building2 size={16} />,
      onSelect: () => runToggle(() => actions.setInternal(user.id, !user.isInternal)),
    },
  ].filter(Boolean) as {
    label: string;
    icon: React.ReactNode;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Privacy controls — always available regardless of plan (brand). */}
      {perms.mutate && (
        <OpsConfirmDialog
          trigger={(open) => (
            <Button variant="secondary" size="sm" onClick={open}>
              <Download size={15} />
              Export data
            </Button>
          )}
          title="Queue data export"
          description="Queues a privacy export of this user's data. Available to every user regardless of plan."
          confirmLabel="Queue export"
          successMessage="Data export queued."
          action={() => actions.requestDataExport(user.id)}
        />
      )}

      {perms.mutate && (
        <OpsReasonDialog
          trigger={(open) => (
            <Button variant="secondary" size="sm" onClick={open}>
              <Trash2 size={15} />
              Queue deletion
            </Button>
          )}
          title="Queue data deletion"
          description="This queues a deletion request for the privacy pipeline. Nothing is removed now. Available to every user regardless of plan."
          confirmLabel="Queue deletion"
          danger
          successMessage="Deletion queued. No data has been removed yet."
          reasonRequired
          action={(reason) => actions.queueDataDeletion(user.id, reason)}
        />
      )}

      {menuItems.length > 0 && <OpsActionMenu items={menuItems} />}

      {/* ---- Menu-driven dialogs (hidden triggers clicked from the menu) ---- */}

      {perms.role && (
        <OpsReasonDialog
          trigger={(open) => (
            <button
              id={tid("role")}
              type="button"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onClick={open}
            />
          )}
          title="Change role"
          description={
            "Update the Ops role for " +
            (user.name || "this user") +
            ". Recorded in the audit log."
          }
          confirmLabel="Update role"
          successMessage="Role updated."
          reasonRequired
          extra={
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate">New role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={roleLocked}
                aria-label="New role"
                className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_META[r].label} ({r})
                  </option>
                ))}
              </select>
              {roleLocked && (
                <p className="mt-1.5 text-xs text-slate">
                  Only an Owner can change an Owner&apos;s role.
                </p>
              )}
            </div>
          }
          action={(reason) => actions.changeRole(user.id, selectedRole, reason)}
        />
      )}

      {perms.disable && (
        <OpsReasonDialog
          trigger={(open) => (
            <button
              id={tid("disable")}
              type="button"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onClick={open}
            />
          )}
          title="Disable account"
          description={
            "This blocks " +
            (user.name || "the user") +
            " from the UniKart app. They can be re-enabled later."
          }
          confirmLabel="Disable account"
          danger
          successMessage="Account disabled."
          reasonRequired
          action={(reason) => actions.disableUser(user.id, reason)}
        />
      )}

      {perms.disable && (
        <OpsReasonDialog
          trigger={(open) => (
            <button
              id={tid("enable")}
              type="button"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onClick={open}
            />
          )}
          title="Re-enable account"
          description={"Restore access for " + (user.name || "the user") + "."}
          confirmLabel="Re-enable account"
          successMessage="Account re-enabled."
          reasonRequired
          action={(reason) => actions.enableUser(user.id, reason)}
        />
      )}

      {perms.mutate && (
        <OpsConfirmDialog
          trigger={(open) => (
            <button
              id={tid("reset")}
              type="button"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onClick={open}
            />
          )}
          title="Reset onboarding"
          description="The user will see the first-run flow again next time they sign in."
          confirmLabel="Reset onboarding"
          successMessage="Onboarding reset."
          action={() => actions.resetOnboarding(user.id)}
        />
      )}
    </div>
  );
}

/** Inline "add note" composer, rendered in the support-notes section. */
export function AddNoteForm({
  userId,
  addSupportNote,
}: {
  userId: string;
  addSupportNote: (userId: string, body: string) => Promise<OpsActionResult>;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function submit() {
    const trimmed = body.trim();
    if (trimmed.length < 1) {
      toast.error("Add a note before saving.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await addSupportNote(userId, trimmed);
        if (res.ok) {
          toast.success(res.message ?? "Note added.");
          setBody("");
          router.refresh();
        } else {
          toast.error(res.message ?? "That didn't work. Please try again.");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an internal note (visible to the team, never the customer)"
        rows={3}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} loading={pending} disabled={body.trim().length < 1}>
          Add note
        </Button>
      </div>
    </div>
  );
}
