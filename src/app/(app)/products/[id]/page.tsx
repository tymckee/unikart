import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, ExternalLink } from "lucide-react";
import { getCollectionsWithCounts, getProductView } from "@/lib/data";
import { buyBrain } from "@/lib/buy-brain";
import {
  durationSince,
  formatPrice,
  prettyDomain,
  priceDelta,
  timeAgo,
} from "@/lib/utils";
import { ProductTile } from "@/components/product/ProductTile";
import { StockBadge, ConfidenceMeter } from "@/components/product/StockBadge";
import { PriceHistoryChart } from "@/components/product/PriceHistoryChart";
import {
  BuyBrainPanel,
  buyBrainFactors,
} from "@/components/product/BuyBrainPanel";
import { ProductDetailActions } from "@/components/product/ProductDetailActions";
import { ProductCollectionsCard } from "@/components/product/ProductCollectionsCard";
import { ShareButton } from "@/components/product/ShareButton";
import { EditProductButton } from "@/components/product/EditProductButton";
import { ProductGistCard } from "@/components/product/ProductGistCard";
import type { ProductGist } from "@/lib/ai/gist";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductView(id);
  if (!product) return { title: "Product" };
  const price = formatPrice(product.currentPrice, product.currency);
  const description = `${price} at ${product.storeName} — tracked on UniKart for price & stock changes.`;
  return {
    title: product.title,
    description,
    openGraph: {
      title: `${product.title} · UniKart`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} · UniKart`,
      description,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductView(id);
  if (!product) notFound();

  const collections = await getCollectionsWithCounts();
  const now = Date.now();
  let initialGist: ProductGist | null = null;
  if (product.gist) {
    try {
      initialGist = JSON.parse(product.gist) as ProductGist;
    } catch {
      /* ignore malformed cache */
    }
  }
  const delta = priceDelta(product.currentPrice, product.previousPrice);
  const target = product.alert?.targetPrice ?? null;
  const brain = buyBrain(product, product.priceHistory, target);
  const factors = buyBrainFactors({
    currentPrice: product.currentPrice,
    lowestPrice: product.lowestPrice,
    availability: product.availability,
    currency: product.currency,
    targetPrice: target,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate transition-colors hover:text-ink"
      >
        <ChevronLeft size={16} /> Hub
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — hero, price, chart */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <ProductTile
              category={product.category}
              imageUrl={product.cutoutUrl ?? product.imageUrl}
              title={product.title}
              storeName={product.storeName}
              className="aspect-square w-full rounded-2xl"
              iconSize={72}
            />
            <div className="flex flex-col justify-center">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {product.collections.map((c) => (
                  <Pill key={c.id} tone="outline">
                    {c.name}
                  </Pill>
                ))}
              </div>
              <h1 className="text-balance text-xl font-semibold tracking-tight text-ink">
                {product.title}
              </h1>
              <a
                href={product.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-slate hover:text-accent"
              >
                {prettyDomain(product.storeDomain)}
                <ExternalLink size={13} />
              </a>

              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="text-3xl font-semibold tracking-tight text-ink">
                  {formatPrice(product.currentPrice, product.currency)}
                </span>
                {delta && delta.direction !== "flat" && (
                  <>
                    <span className="text-sm text-silver line-through">
                      {formatPrice(product.previousPrice, product.currency)}
                    </span>
                    <Pill tone={delta.direction === "down" ? "down" : "up"}>
                      {delta.pct > 0 ? "+" : ""}
                      {delta.pct.toFixed(0)}%
                    </Pill>
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StockBadge availability={product.availability} />
                <span className="inline-flex items-center gap-1.5 text-xs text-slate">
                  <ConfidenceMeter confidence={product.metadataConfidence} />
                  {product.metadataConfidence} confidence
                </span>
              </div>

              {/* How long this has been waiting — quiet, intentional */}
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate">
                <Clock size={12} className="text-silver" />
                {product.releasedAt ? (
                  <span>
                    Considered for{" "}
                    {durationSince(product.createdAt, product.releasedAt)} before
                    you let it go
                  </span>
                ) : (
                  <span>Considering for {durationSince(product.createdAt, now)}</span>
                )}
              </p>

              <div className="mt-5 flex gap-2">
                <ShareButton title={product.title} />
                <EditProductButton product={product} />
              </div>
            </div>
          </div>

          {/* Price history */}
          <GlassCard variant="solid" className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Price history</h2>
              <div className="flex items-center gap-3 text-xs text-slate">
                <span>
                  Low{" "}
                  <span className="font-medium text-down">
                    {formatPrice(product.lowestPrice, product.currency)}
                  </span>
                </span>
                <span>
                  High{" "}
                  <span className="font-medium text-ink">
                    {formatPrice(product.highestPrice, product.currency)}
                  </span>
                </span>
              </div>
            </div>
            <PriceHistoryChart
              history={product.priceHistory}
              currency={product.currency}
              targetPrice={target}
            />
          </GlassCard>

          {/* The gist (AI) */}
          <ProductGistCard productId={product.id} initial={initialGist} />

          {/* Availability + details */}
          <div className="grid gap-5 sm:grid-cols-2">
            <GlassCard variant="solid" className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Availability</h2>
              <div className="flex items-center justify-between">
                <StockBadge availability={product.availability} />
                <span className="text-xs text-slate">
                  Checked {timeAgo(product.lastCheckedAt ?? product.updatedAt, now)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate">
                {product.availability === "out_of_stock"
                  ? "Currently unavailable. We'll alert you the moment it returns."
                  : product.availability === "low_stock"
                    ? "Limited stock reported. Worth deciding soon."
                    : "In stock and available to buy on the merchant's site."}
              </p>
            </GlassCard>

            <GlassCard variant="solid" className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
              <dl className="space-y-2 text-sm">
                <Detail label="Brand" value={product.brand} />
                <Detail label="Category" value={product.category} />
                <Detail label="Store" value={product.storeName} />
                <Detail
                  label="Added"
                  value={timeAgo(product.createdAt, now)}
                />
              </dl>
            </GlassCard>
          </div>
        </div>

        {/* Right — Signal + actions */}
        <div className="space-y-5">
          <BuyBrainPanel result={brain} factors={factors} />
          <ProductDetailActions product={product} />
          <ProductCollectionsCard
            productId={product.id}
            selectedIds={product.collections.map((c) => c.id)}
            allCollections={collections.map((c) => ({
              id: c.id,
              name: c.name,
              icon: c.icon,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate">{label}</dt>
      <dd className="font-medium text-ink">{value ?? "—"}</dd>
    </div>
  );
}
