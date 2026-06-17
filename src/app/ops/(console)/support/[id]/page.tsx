import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock, Mail } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsKeyValue } from "@/components/ops/OpsKeyValue";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsAuditTrail } from "@/components/ops/OpsAuditTrail";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { getAuditForTarget } from "@/lib/ops/data/audit";
import {
  getTicketDetail,
  getAssignableOperators,
  categoryLabel,
} from "@/lib/ops/data/support";
import {
  addNote,
  setStatus,
  assignTicket,
  linkTicket,
  triggerParseRetry,
  triggerNotificationResend,
  queueAccountAction,
} from "@/lib/ops/actions/support";
import { SupportActions } from "@/components/ops/support/SupportActions";
import { dateTime, shortId } from "@/lib/ops/format";

/**
 * Support ticket detail — header, linked records, the note thread, an action
 * panel, and a read-only audit trail. All ticket data is a real DB read; the
 * action panel passes bound server actions down to the client component.
 */
export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, "neutral" | "accent" | "warn" | "up"> = {
  low: "neutral",
  normal: "accent",
  high: "warn",
  urgent: "up",
};

export default async function SupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getOpsViewer();
  const canWrite = can(viewer, "support.write");

  const [ticket, operators] = await Promise.all([
    getTicketDetail(id),
    getAssignableOperators(),
  ]);

  if (!ticket) notFound();

  const audit = await getAuditForTarget("support_ticket", ticket.id, 12);

  return (
    <>
      <div className="mb-4">
        <Link
          href="/ops/support"
          className="inline-flex items-center gap-1.5 text-sm text-slate transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Support
        </Link>
      </div>

      <OpsPageHeader
        title={ticket.subject}
        description={"Ticket " + shortId(ticket.id) + " · opened " + dateTime(ticket.createdAt)}
        actions={
          <div className="flex items-center gap-2">
            <Pill tone={PRIORITY_TONE[ticket.priority] ?? "neutral"} className="capitalize">
              {ticket.priority}
            </Pill>
            <OpsStatusPill status={ticket.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details, links, notes, audit */}
        <div className="space-y-6 lg:col-span-2">
          <OpsSection title="Ticket">
            <GlassCard className="p-5">
              <OpsKeyValue
                columns={2}
                items={[
                  { label: "Status", value: <OpsStatusPill status={ticket.status} /> },
                  {
                    label: "Priority",
                    value: (
                      <span className="capitalize">{ticket.priority}</span>
                    ),
                  },
                  { label: "Category", value: categoryLabel(ticket.category) },
                  {
                    label: "Customer email",
                    value: ticket.email,
                    sensitive: true,
                  },
                  {
                    label: "Assigned to",
                    value: ticket.assignedToName ?? "Unassigned",
                  },
                  { label: "Created", value: dateTime(ticket.createdAt) },
                  { label: "Last updated", value: dateTime(ticket.updatedAt) },
                  {
                    label: "Closed",
                    value: ticket.closedAt ? dateTime(ticket.closedAt) : "—",
                  },
                ]}
              />
            </GlassCard>
          </OpsSection>

          <OpsSection title="Linked records">
            <GlassCard className="p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate">User</span>
                  {ticket.userId ? (
                    <Link
                      href={"/ops/users/" + ticket.userId}
                      className="inline-flex items-center gap-1.5 text-sm text-accent-ink transition-colors hover:underline"
                    >
                      {ticket.userName ?? ticket.userEmail ?? shortId(ticket.userId)}
                      <ExternalLink size={13} />
                    </Link>
                  ) : (
                    <span className="text-sm text-silver">Not linked</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-xs font-medium text-slate">Product</span>
                  {ticket.productId ? (
                    <Link
                      href={"/ops/products/" + ticket.productId}
                      className="inline-flex items-center gap-1.5 truncate text-sm text-accent-ink transition-colors hover:underline"
                    >
                      {ticket.productTitle ?? shortId(ticket.productId)}
                      <ExternalLink size={13} className="shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm text-silver">Not linked</span>
                  )}
                </div>
              </div>
            </GlassCard>
          </OpsSection>

          <OpsSection
            title="Notes"
            description="Chronological. Internal notes stay private to the team."
          >
            {ticket.notes.length === 0 ? (
              <GlassCard className="px-5 py-8 text-center">
                <p className="text-sm text-slate">No notes yet.</p>
              </GlassCard>
            ) : (
              <ol className="space-y-3">
                {ticket.notes.map((n) => (
                  <li key={n.id}>
                    <GlassCard className="p-4">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {n.adminName ?? n.adminEmail ?? "Operator"}
                        </span>
                        {n.visibility === "customer" ? (
                          <Pill tone="accent" icon={<Mail size={11} />}>
                            Customer reply
                          </Pill>
                        ) : (
                          <Pill tone="neutral" icon={<Lock size={11} />}>
                            Internal
                          </Pill>
                        )}
                        <span className="ml-auto text-xs tabular-nums text-silver">
                          {dateTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-ink text-pretty">
                        {n.body}
                      </p>
                    </GlassCard>
                  </li>
                ))}
              </ol>
            )}
          </OpsSection>

          {can(viewer, "audit.read") && (
            <OpsSection title="Activity" description="Audited actions on this ticket.">
              <GlassCard className="p-5">
                <OpsAuditTrail entries={audit} emptyText="No audited activity yet." />
              </GlassCard>
            </OpsSection>
          )}
        </div>

        {/* Right: action panel */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <h2 className="mb-3 text-sm font-semibold tracking-tight text-ink">Actions</h2>
            <SupportActions
              ticketId={ticket.id}
              userId={ticket.userId}
              hasProduct={Boolean(ticket.productId)}
              status={ticket.status}
              assignedToId={ticket.assignedToId}
              operators={operators}
              canWrite={canWrite}
              addNote={addNote}
              setStatus={setStatus}
              assignTicket={assignTicket}
              linkTicket={linkTicket}
              triggerParseRetry={triggerParseRetry}
              triggerNotificationResend={triggerNotificationResend}
              queueAccountAction={queueAccountAction}
            />
          </div>
        </div>
      </div>
    </>
  );
}
