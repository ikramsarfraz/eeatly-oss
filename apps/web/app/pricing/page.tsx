import Link from "next/link";
import type { Metadata, Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv, hasStripeEnv, isLaunchFreeAccess } from "@/lib/env/server";
import { TIER_FEATURES } from "@/lib/pricing";
import { getSubscriptionState } from "@/services/billing";
import { getStripeCatalog, perMonthDisplay } from "@/services/stripe-catalog";
import { PricingCard } from "@/components/pricing/pricing-card";
import "../marketing.css";

export const metadata: Metadata = {
  title: "Pricing — eeatly",
  description:
    "Cook is free forever. Chef shares your kitchen with family — household sharing, meal plans, and public recipe links. Master Chef adds co-editing, shareable plans, and priority AI."
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const env = getServerEnv();
  const billingConfigured = hasStripeEnv(env);
  const launchMode = isLaunchFreeAccess(env);
  const user = await getCurrentUser();

  // Subscription lookup only matters when a user is signed in AND
  // billing is configured — otherwise no upgrade state to surface.
  const subscription =
    user && billingConfigured ? await getSubscriptionState({ userId: user.id }) : null;
  const isActiveSubscriber =
    subscription?.status === "active" || subscription?.status === "trialing";

  const authState: React.ComponentProps<typeof PricingCard>["authState"] = !user
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
  const proPrices = tierPrices(catalog.tiers.pro);

  return (
    <div className="mkt min-h-screen">
    <main
      id="main"
      tabIndex={-1}
      className="mkt-doc mx-auto max-w-3xl px-4 py-10 pb-20 sm:px-6 sm:py-12"
    >
      <header className="mb-8 grid gap-3">
        <Link href="/" className="flex w-fit items-center text-foreground">
          <Wordmark size={30} />
        </Link>
        <h1 className="font-serif text-[36px] font-normal leading-tight tracking-[-0.005em] sm:text-[42px]">
          A kitchen that remembers what worked
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Cook keeps your personal cooking library forever, free. Chef shares
          your kitchen with family and adds meal planning + public recipe
          links. Master Chef is for cooking together — co-editing, shareable
          plans, and priority AI. Every new account starts with a 14-day
          Master Chef trial, no card needed.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <PricingCard
          tier="plus"
          prices={plusPrices}
          launchMode={launchMode}
          authState={authState}
          features={TIER_FEATURES.plus}
        />
        <PricingCard
          tier="pro"
          prices={proPrices}
          launchMode={false}
          authState={authState}
          features={TIER_FEATURES.pro}
        />
      </div>

      <section className="mt-10 grid gap-3 rounded-2xl border bg-background/60 p-6">
        <h2 className="text-lg font-semibold tracking-normal">Out of credits? Top up anytime</h2>
        <p className="text-sm text-muted-foreground">
          AI features (photo / text / voice prefill, Refine, ingredient
          extraction) run on credits. Every plan includes a monthly grant —
          15 on Cook, 300 on Chef, 1,500 on Master Chef — and you can buy one-time top-up
          packs that never expire from <Link href={"/settings" as Route} className="text-primary underline-offset-2 hover:underline">Settings</Link>.
        </p>
      </section>

      <section className="mt-10 grid gap-3">
        <h2 className="text-lg font-semibold tracking-normal">What&apos;s on the free plan</h2>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {TIER_FEATURES.free.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-4">
        <h2 className="text-lg font-semibold tracking-normal">Common questions</h2>
        <dl className="grid gap-4 text-sm">
          <div className="grid gap-1">
            <dt className="font-medium text-foreground">How does the free Master Chef trial work?</dt>
            <dd className="text-muted-foreground">
              Every new account gets 14 days of Master Chef automatically — no
              card needed. You&apos;ll have the full set of features, including
              co-editing and priority AI. Near the end we&apos;ll prompt you to
              pick a plan; if you don&apos;t, your account simply drops to the
              free Cook tier and your library stays exactly as it is.
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-foreground">What&apos;s the difference between Chef and Master Chef?</dt>
            <dd className="text-muted-foreground">
              Chef shares your kitchen with family — invites, meal plans, and
              public recipe links — with 300 AI credits a month. Master Chef is
              for cooking together: family can edit your recipes and plans in
              place, you can share meal plans as public pages, you get 1,500
              credits, and AI runs without burst limits.
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-foreground">Can I cancel anytime?</dt>
            <dd className="text-muted-foreground">
              When paid plans begin you&apos;ll be able to cancel from the Settings
              page, and access stays through the end of the period you paid for.
              Annual is billed yearly and works out to two months free.
            </dd>
          </div>
        </dl>
      </section>

      <footer className="mt-12 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Link href={"/privacy" as Route} className="hover:text-foreground">
          Privacy
        </Link>
        <Link href={"/help" as Route} className="hover:text-foreground">
          Help
        </Link>
      </footer>
    </main>
    </div>
  );
}
