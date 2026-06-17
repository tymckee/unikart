import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Link2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { getProductView } from "@/lib/mock-data";
import { buyBrain } from "@/lib/buy-brain";
import { formatPrice } from "@/lib/utils";
import { Wordmark, WheelLogo } from "@/components/brand/WheelLogo";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { GlassCard } from "@/components/ui/GlassCard";
import { HubProvider } from "@/components/hub/HubProvider";
import { CommandPasteBar, PasteHint } from "@/components/product/CommandPasteBar";
import { ProductTile } from "@/components/product/ProductTile";
import { StockBadge } from "@/components/product/StockBadge";
import { PriceHistoryChart } from "@/components/product/PriceHistoryChart";
import { BuyBrainPanel } from "@/components/product/BuyBrainPanel";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  const sample = getProductView("p_sony_xm5")!;
  const brain = buyBrain(sample, sample.priceHistory, sample.alert?.targetPrice);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line">
        <div className="glass-strong">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
            <Wordmark />
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate transition-colors hover:text-ink sm:block"
              >
                Sign in
              </Link>
              <Button href="/dashboard" size="sm">
                Open UniKart
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* soft radial wheel backdrop */}
          <div
            className="pointer-events-none absolute left-1/2 top-[-12rem] -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(0,113,227,0.10) 0%, rgba(0,113,227,0) 70%)",
            }}
          />
          <div className="mx-auto w-full max-w-3xl px-5 pt-16 pb-10 text-center sm:pt-24">
            <div className="mb-6 flex justify-center">
              <Pill tone="outline" icon={<Sparkles size={13} className="text-accent" />}>
                A calm buying operating system
              </Pill>
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Save anything.
              <br />
              Buy at the right moment.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-slate">
              UniKart keeps every product you&apos;re eyeing in one calm place —
              tracking price and stock, and guiding you through checkout across
              stores.
            </p>

            <div className="mx-auto mt-9 max-w-xl">
              <HubProvider>
                <CommandPasteBar variant="hero" redirectAfterSave="/dashboard" />
              </HubProvider>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button href="/demo" variant="secondary">
                  Try the demo <ArrowRight size={16} />
                </Button>
                <PasteHint />
              </div>
            </div>
          </div>

          {/* Product preview */}
          <div className="mx-auto w-full max-w-4xl px-5 pb-8">
            <div className="grid gap-4 sm:grid-cols-5">
              <GlassCard variant="glass" className="p-5 sm:col-span-3">
                <div className="flex items-center gap-4">
                  <ProductTile
                    category={sample.category}
                    title={sample.title}
                    storeName={sample.storeName}
                    className="h-20 w-20 shrink-0 rounded-xl"
                    iconSize={28}
                    watermark={false}
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-ink">
                      {sample.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-lg font-semibold text-ink">
                        {formatPrice(sample.currentPrice, sample.currency)}
                      </span>
                      <Pill tone="down" icon={<TrendingDown size={11} />}>
                        18%
                      </Pill>
                    </div>
                    <div className="mt-1.5">
                      <StockBadge availability={sample.availability} />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <PriceHistoryChart
                    history={sample.priceHistory}
                    currency={sample.currency}
                    targetPrice={sample.alert?.targetPrice}
                    height={140}
                  />
                </div>
              </GlassCard>
              <div className="sm:col-span-2">
                <BuyBrainPanel result={brain} compact />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            <Feature
              icon={<Link2 size={20} />}
              title="Save from anywhere"
              body="Paste a link from almost any store. We read the title, image, price, and stock — no logins, no clutter."
            />
            <Feature
              icon={<TrendingDown size={20} />}
              title="Know when to buy"
              body="Price history, target alerts, and a calm Buy / Wait / Watch read on every item you're tracking."
            />
            <Feature
              icon={<ShoppingBag size={20} />}
              title="Check out with less chaos"
              body="Your Universal Cart groups items by store and walks you through each checkout, one step at a time."
            />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-canvas/60">
          <div className="mx-auto w-full max-w-5xl px-5 py-16">
            <div className="mb-10 text-center">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Calm by design
              </h2>
              <p className="mx-auto mt-2 max-w-md text-pretty text-slate">
                Three quiet steps, from the thing you want to the moment you buy.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Step n={1} title="Paste a link" body="From any store. We gather the details for you in seconds." />
              <Step n={2} title="We track it" body="Price and stock, quietly, in the background — with alerts you control." />
              <Step n={3} title="Buy with the Assistant" body="Grouped by store, verified, and guided one calm step at a time." />
            </div>
          </div>
        </section>

        {/* Brand moment */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 text-center">
          <div className="flex justify-center">
            <WheelLogo size={64} spinning className="text-ink" />
          </div>
          <h2 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Hub. Spokes. Rim.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-slate">
            A wheel is balance in motion — a hub at the center, spokes holding it
            true, a rim that carries you forward. UniKart brings that same quiet
            order to everything you want to buy.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-down" /> No store logins
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bell size={15} className="text-accent" /> Alerts you control
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShoppingBag size={15} className="text-ink" /> Checkout stays on the
              merchant
            </span>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-20">
          <GlassCard
            variant="solid"
            className="flex flex-col items-center gap-6 px-6 py-14 text-center"
          >
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink">
              Bring calm to how you buy.
            </h2>
            <p className="max-w-md text-pretty text-slate">
              Start your Universal Cart today. It&apos;s free to save, organize,
              and track.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button href="/dashboard" size="lg">
                Open UniKart <ArrowRight size={18} />
              </Button>
              <Button href="/demo" size="lg" variant="secondary">
                Try the demo
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <GlassCard variant="solid" className="p-6">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-ink">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-pretty text-sm text-slate">{body}</p>
    </GlassCard>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-ink shadow-soft">
        {n}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-pretty text-sm text-slate">{body}</p>
    </div>
  );
}
