import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsKeyValue } from "@/components/ops/OpsKeyValue";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsAuditTrail } from "@/components/ops/OpsAuditTrail";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { Sparkline } from "@/components/ops/Charts";
import { Pill } from "@/components/ui/Pill";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProductActions } from "@/components/ops/products/ProductActions";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { getProductDetail } from "@/lib/ops/data/products";
import { getAuditForTarget } from "@/lib/ops/data/audit";
import { usd, dateTime, shortDate, duration, truncate } from "@/lib/ops/format";
import {
  reparseProduct,
  runCheckNow,
  markNeedsReview,
  updateStoreNormalization,
  disableTracking,
  archiveForUser,
  addProductNote,
} from "@/lib/ops/actions/products";

/**
 * Product detail — the full picture of one saved item: metadata, links, price
 * history, stock and parse history, where it lives, and the recent admin trail.
 * Real DB values throughout (no fabricated data). Owner's private notes are
 * marked sensitive and only shown when present.
 */
export const dynamic = "force-dynamic";

const CONFIDENCE_TONE: Record<string, "down" | "warn" | "up" | "neutral"> = {
  high: "down",
  medium: "warn",
  low: "up",
};

const TRACKING_LABEL: Record<string, string> = {
  tracking: "Tracking",
  purchased: "Purchased",
  released: "Released",
  archived: "Archived",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, viewer] = await Promise.all([getProductDetail(id), getOpsViewer()]);
  if (!product) notFound();

  const audit = await getAuditForTarget("product", id);

  const canReparse = can(viewer, "products.reparse");
  const canMutate = can(viewer, "products.mutate");

  return (
    <>
      <div className="mb-4">
        <Link
          href="/ops/products"
          className="inline-flex items-center gap-1.5 text-sm text-slate transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Products
        </Link>
      </div>

      <OpsPageHeader
        title={truncate(product.title, 80)}
        description={product.brand ? product.brand + " · " + product.storeName : product.storeName}
        actions={
          <ProductActions
            productId={product.id}
            storeName={product.storeName}
            storeDomain={product.storeDomain}
            can={{ reparse: canReparse, mutate: canMutate }}
            reparseProduct={reparseProduct}
            runCheckNow={runCheckNow}
            markNeedsReview={markNeedsReview}
            updateStoreNormalization={updateStoreNormalization}
            disableTracking={disableTracking}
            archiveForUser={archiveForUser}
            addProductNote={addProductNote}
          />
        }
      />

      {/* Snapshot pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <OpsStatusPill status={product.availability} />
        <Pill tone={CONFIDENCE_TONE[product.metadataConfidence] ?? "neutral"} className="capitalize">
          {product.metadataConfidence} confidence
        </Pill>
        <OpsStatusPill
          status={product.trackingState}
          label={TRACKING_LABEL[product.trackingState] ?? product.trackingState}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: image + price + metadata */}
        <div className="space-y-6 lg:col-span-2">
          <OpsSection title="Overview">
            <GlassCard className="p-5">
              <div className="flex gap-5">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.cutoutUrl ?? product.imageUrl}
                    alt={product.title}
                    className="h-24 w-24 shrink-0 rounded-xl border border-line object-contain bg-white"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-silver">
                    <Package size={26} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                      {product.currentPrice == null ? "—" : usd(product.currentPrice)}
                    </span>
                    {product.previousPrice != null && (
                      <span className="text-sm text-slate">
                        was{" "}
                        <span className="tabular-nums">{usd(product.previousPrice)}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate sm:grid-cols-3">
                    <span>
                      Lowest{" "}
                      <span className="tabular-nums text-ink">
                        {product.lowestPrice == null ? "—" : usd(product.lowestPrice)}
                      </span>
                    </span>
                    <span>
                      Highest{" "}
                      <span className="tabular-nums text-ink">
                        {product.highestPrice == null ? "—" : usd(product.highestPrice)}
                      </span>
                    </span>
                    <span>
                      Currency <span className="text-ink">{product.currency}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="mt-5 space-y-1.5 border-t border-line pt-4">
                <LinkRow label="Original URL" href={product.originalUrl} />
                {product.canonicalUrl && (
                  <LinkRow label="Canonical URL" href={product.canonicalUrl} />
                )}
              </div>
            </GlassCard>
          </OpsSection>

          {/* Price history */}
          <OpsSection
            title="Price history"
            description="From recorded price snapshots — based on tracked price history."
          >
            <GlassCard className="p-5">
              {product.priceHistory.length >= 2 ? (
                <>
                  <Sparkline
                    data={product.priceHistory.map((p) => ({ label: p.label, value: p.value }))}
                    tone="accent"
                    height={64}
                    ariaLabel="Price over time"
                  />
                  <div className="mt-2 flex justify-between text-xs text-silver tabular-nums">
                    <span>{shortDate(product.priceHistory[0].checkedAt)}</span>
                    <span>
                      {shortDate(product.priceHistory[product.priceHistory.length - 1].checkedAt)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate">
                  Not enough price snapshots yet to draw a trend.
                </p>
              )}
            </GlassCard>
          </OpsSection>

          {/* Parse attempts */}
          <OpsSection
            title="Parse attempts"
            description="The most recent reads of this page (latest first)."
          >
            <GlassCard className="overflow-hidden">
              {product.parseAttempts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate">No parse attempts recorded.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {product.parseAttempts.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <OpsStatusPill status={a.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          {a.extractionMethod ?? "unknown method"}
                          {a.confidence ? (
                            <span className="text-slate"> · {a.confidence} confidence</span>
                          ) : null}
                          {a.durationMs != null ? (
                            <span className="text-slate"> · {duration(a.durationMs)}</span>
                          ) : null}
                        </p>
                        {a.errorMessage && (
                          <p className="mt-0.5 text-xs text-up text-pretty">
                            {a.errorCode ? a.errorCode + ": " : ""}
                            {truncate(a.errorMessage, 140)}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-silver tabular-nums">
                          {dateTime(a.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </OpsSection>

          {/* Raw metadata (sanitized) */}
          <OpsSection
            title="Parsed metadata"
            description="A non-sensitive sample of what the parser read — secrets and cookies are never shown."
          >
            <GlassCard className="p-5">
              {product.rawMetadataSafe.length === 0 ? (
                <p className="text-sm text-slate">
                  No readable metadata sample (or nothing safe to show).
                </p>
              ) : (
                <OpsKeyValue
                  columns={2}
                  items={product.rawMetadataSafe.map((m) => ({
                    label: m.key,
                    value: <span className="font-mono text-[0.8125rem]">{m.value}</span>,
                  }))}
                />
              )}
            </GlassCard>
          </OpsSection>
        </div>

        {/* Right: metadata, history, usage, audit */}
        <div className="space-y-6">
          <OpsSection title="Details">
            <GlassCard className="p-5">
              <OpsKeyValue
                items={[
                  { label: "Product ID", value: product.id, mono: true },
                  { label: "Customer", value: product.userEmail, sensitive: true },
                  { label: "Store", value: product.storeName },
                  { label: "Domain", value: product.storeDomain, mono: true },
                  { label: "Brand", value: product.brand ?? "—" },
                  { label: "SKU", value: product.sku ?? "—", mono: !!product.sku },
                  { label: "Category", value: product.category ?? "—" },
                  {
                    label: "Confidence",
                    value: (
                      <Pill
                        tone={CONFIDENCE_TONE[product.metadataConfidence] ?? "neutral"}
                        className="capitalize"
                      >
                        {product.metadataConfidence}
                      </Pill>
                    ),
                  },
                  { label: "Saved", value: shortDate(product.createdAt) },
                  {
                    label: "Last checked",
                    value: product.lastCheckedAt ? dateTime(product.lastCheckedAt) : "never",
                  },
                  {
                    label: "Purchased",
                    value: product.purchasedAt ? dateTime(product.purchasedAt) : "—",
                  },
                  {
                    label: "Released",
                    value: product.releasedAt ? dateTime(product.releasedAt) : "—",
                  },
                ]}
              />
            </GlassCard>
          </OpsSection>

          {/* Stock snapshots */}
          <OpsSection title="Stock history">
            <GlassCard className="overflow-hidden">
              {product.stockSnapshots.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate">No stock snapshots yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {product.stockSnapshots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-5 py-2.5"
                    >
                      <OpsStatusPill status={s.availability} />
                      <span className="text-xs text-silver tabular-nums">
                        {dateTime(s.checkedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </OpsSection>

          {/* Cart usage */}
          <OpsSection title="In carts">
            <GlassCard className="overflow-hidden">
              {product.cartUsage.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate">Not in any Universal Cart.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {product.cartUsage.map((c) => (
                    <li key={c.cartId} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-ink">{c.cartName}</span>
                        <OpsStatusPill status={c.cartStatus} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate">
                        Qty {c.quantity} · {c.checkoutStatus} · added {shortDate(c.addedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </OpsSection>

          {/* Notifications */}
          <OpsSection title="Notifications">
            <GlassCard className="overflow-hidden">
              {product.notifications.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate">No notifications for this product.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {product.notifications.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-ink">{n.title}</span>
                        {!n.read && <Pill tone="accent">unread</Pill>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate text-pretty">
                        {truncate(n.body, 100)}
                      </p>
                      <p className="mt-0.5 text-xs text-silver tabular-nums">
                        {dateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </OpsSection>

          {/* User notes — sensitive, only when present */}
          {product.notes && product.notes.trim() && (
            <OpsSection title="Customer notes">
              <GlassCard className="p-5">
                <div className="mb-2">
                  <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[0.625rem] font-medium text-warn">
                    sensitive · customer&apos;s private note
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink text-pretty">
                  {product.notes}
                </p>
              </GlassCard>
            </OpsSection>
          )}

          {/* Recent admin activity */}
          <OpsSection title="Recent admin activity">
            <GlassCard className="p-5">
              {audit.length === 0 ? (
                <OpsEmptyState
                  title="No admin activity"
                  description="Actions taken on this product will appear here."
                />
              ) : (
                <OpsAuditTrail entries={audit} />
              )}
            </GlassCard>
          </OpsSection>
        </div>
      </div>
    </>
  );
}

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs font-medium text-slate">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex min-w-0 items-center gap-1 text-sm text-accent-ink underline-offset-2 hover:underline"
      >
        <span className="truncate">{truncate(href, 52)}</span>
        <ExternalLink size={13} className="shrink-0" />
      </a>
    </div>
  );
}
