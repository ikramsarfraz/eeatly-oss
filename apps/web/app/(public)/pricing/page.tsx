import Link from "next/link";
import type { Metadata, Route } from "next";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv, hasStripeEnv, isLaunchFreeAccess } from "@/lib/env/server";
import { displayedMonthlyCredits, TIERS, type Tier } from "@/lib/pricing";
import { getSubscriptionState } from "@/services/billing";
import { getStripeCatalog, perMonthDisplay } from "@/services/stripe-catalog";
import { PricingGrid } from "@/components/pricing/pricing-grid";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Cook is free forever. Chef shares your kitchen with family: household sharing, meal plans, and public recipe links. Master Chef adds co-editing, shareable plans, and priority AI.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "eeatly pricing",
    description:
      "Cook is free forever. Paid tiers add shared kitchens, meal planning, co-editing, and more AI.",
    url: "/pricing",
    type: "website"
  }
};

export const dynamic = "force-dynamic";

const GRANT_PIP: Record<Tier, string> = {
  free: "bg-[var(--border-strong)]",
  plus: "bg-primary/60",
  premium: "bg-primary/80",
  pro: "bg-primary"
};

export default async function PricingPage() {
  const env = getServerEnv();
  const billingConfigured = hasStripeEnv(env);
  const launchMode = isLaunchFreeAccess(env);
  const user = await getCurrentUser();

  // Subscription lookup only matters when a user is signed in AND billing is
  // configured — otherwise there's no upgrade state to surface.
  const subscription =
    user && billingConfigured ? await getSubscriptionState({ userId: user.id }) : null;
  const isActiveSubscriber =
    subscription?.status === "active" || subscription?.status === "trialing";

  const authState: React.ComponentProps<typeof PricingGrid>["authState"] = !user
    ? { kind: "anonymous" }
    : isActiveSubscriber
      ? { kind: "active_subscriber", tier: subscription?.tier ?? "plus" }
      : { kind: "signed_in_free" };

  // Live prices come from the Stripe catalog (metadata-tagged), not env.
  const catalog = await getStripeCatalog();
  const tierPrices = (tp: (typeof catalog.tiers)["plus"]) => ({
    monthly: tp.monthly ? { display: tp.monthly.display } : null,
    annual: tp.annual
      ? { display: tp.annual.display, perMonthDisplay: perMonthDisplay(tp.annual) }
      : null
  });
  const plusPrices = tierPrices(catalog.tiers.plus);
  const premiumPrices = tierPrices(catalog.tiers.premium);
  const proPrices = tierPrices(catalog.tiers.pro);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Decorative dot grid bleeding full-width out of the top. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-20 dark:opacity-[0.38]"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--border-strong) 70%, transparent) 1px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(180deg, #000 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 100%)"
        }}
      />

      <div className="mkt-doc relative z-[1] mx-auto max-w-[1120px] px-7 pb-16 pt-10">
        {/* Header */}
        <header className="pb-11">
          <span className="mb-5 inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[1.8px] text-primary">
            <span aria-hidden className="h-px w-[26px] bg-primary/55" />
            Plans &amp; pricing
          </span>
          <h1 className="mb-5 max-w-[14ch] font-serif text-[clamp(40px,6vw,62px)] font-normal leading-[1.02] tracking-[-0.025em] text-foreground">
            A kitchen that remembers what worked
          </h1>
          <p className="max-w-[56ch] text-pretty text-[17px] leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Cook</strong> keeps your personal
            cooking library forever, free. <strong className="font-semibold text-foreground">Chef</strong>{" "}
            shares your kitchen with family and adds meal planning plus public recipe links.{" "}
            <strong className="font-semibold text-foreground">Master&nbsp;Chef</strong> is for cooking
            together: co-editing, shareable plans, and priority AI.
          </p>
          <span className="mt-6 inline-flex items-center gap-2.5 rounded-full border bg-[var(--primary-soft)] py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Every new account starts with a 7-day Master Chef trial, no card needed.
          </span>
        </header>

        {/* Launch promo banner — understated + honest. Only while launch
            free-access is on; auto-hides once Stripe is wired. */}
        {launchMode ? (
          <div className="mb-8 flex items-start gap-3 rounded-[14px] border bg-[var(--sage-soft,var(--primary-soft))] px-5 py-3.5 text-[13.5px] leading-relaxed text-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p>
              <strong className="font-semibold">Every plan is free during launch, no card needed.</strong>{" "}
              Pick whichever plan fits. When paid plans go live you&apos;ll keep your library and simply
              choose how to continue.
            </p>
          </div>
        ) : null}

        {/* Billing toggle + three-card grid */}
        <PricingGrid
          authState={authState}
          launchMode={launchMode}
          plusPrices={plusPrices}
          premiumPrices={premiumPrices}
          proPrices={proPrices}
        />

        {/* Top up */}
        <section className="mt-14 overflow-hidden rounded-[20px] border bg-[var(--surface)]">
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="border-b border-[var(--border-soft,var(--border))] p-[30px] md:border-b-0 md:border-r">
              <h2 className="mb-3 font-serif text-[28px] font-normal tracking-[-0.015em] text-foreground">
                Out of credits? Top up anytime
              </h2>
              <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                AI features (photo / text / voice prefill, Refine, ingredient extraction) run on
                credits. Every plan includes a monthly grant, and you can buy one-time top-up packs
                that never expire from{" "}
                <Link
                  href={"/settings" as Route}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Settings
                </Link>
                .
              </p>
            </div>
            <div className="grid content-center gap-0.5 bg-[var(--surface-2)] p-[26px_30px]">
              {(["free", "plus", "pro"] as Tier[]).map((tier, i, arr) => (
                <div
                  key={tier}
                  className={i < arr.length - 1 ? "flex items-baseline justify-between gap-4 border-b border-dashed border-[color:var(--border)] py-2.5" : "flex items-baseline justify-between gap-4 py-2.5"}
                >
                  <span className="inline-flex items-center gap-2.5 text-[13.5px] font-semibold text-foreground">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${GRANT_PIP[tier]}`} />
                    {TIERS[tier].name}
                  </span>
                  <span className="font-mono text-[13px] text-muted-foreground">
                    <b className="font-semibold text-foreground">
                      {displayedMonthlyCredits(tier, launchMode).toLocaleString()}
                    </b>{" "}
                    credits / mo
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-16 scroll-mt-24">
          <h2 className="mb-1.5 font-serif text-[34px] font-normal tracking-[-0.02em] text-foreground">
            Common questions
          </h2>
          <p className="mb-7 text-[15px] text-muted-foreground">
            Everything about trials, tiers, and billing.
          </p>
          <dl className="grid gap-3.5 sm:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.q}
                className="rounded-[16px] border bg-[var(--surface)] p-6"
              >
                <dt className="mb-2 text-[15px] font-semibold text-foreground">{item.q}</dt>
                <dd className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

      </div>
    </div>
  );
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How does the free Master Chef trial work?",
    a: "Every new account gets 7 days of Master Chef automatically, no card needed. You'll have the full set of features, including co-editing and priority AI. Near the end we'll prompt you to pick a plan; if you don't, your account simply drops to Cook and your library stays exactly as it is."
  },
  {
    q: "What's the difference between Chef and Master Chef?",
    a: "Chef shares your kitchen with family (invites, meal plans, and public recipe links) with 300 AI credits a month. Master Chef is for cooking together: family can edit your recipes and plans in place, you can share meal plans as public pages, you get 1,500 credits, and AI runs without burst limits."
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Settings page and access stays through the end of the period you paid for. Annual is billed yearly at a lower monthly rate than paying month to month."
  },
  {
    q: "What can I do on the free Cook plan?",
    a: "Keep your personal recipe library forever, log every cook with notes & photos, search your full cooking history, get rediscovery suggestions, and use 40 AI credits a month. No sharing or meal plans; those start at Chef."
  }
];
