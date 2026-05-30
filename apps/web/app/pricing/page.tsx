import Link from "next/link";
import type { Metadata, Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv, hasStripeEnv, isLaunchFreeAccess } from "@/lib/env/server";
import { FEATURE_REGISTRY, type FeatureKey } from "@eeatly/api/gates/registry";
import { getSubscriptionState } from "@/services/billing";
import { PricingCard } from "@/components/pricing/pricing-card";

export const metadata: Metadata = {
  title: "Pricing — eeatly Plus",
  description:
    "eeatly Plus unlocks AI prefill from photos / text / voice, public recipe share links, household sharing, and planning. Free tier keeps your cooking memory."
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
      ? { kind: "active_subscriber" }
      : { kind: "signed_in_free" };

  // Marketing copy pulls feature descriptions from the registry so the
  // comparison stays in sync with what's actually gated. Same source the
  // /admin/features panel uses.
  const plusFeatures = (Object.keys(FEATURE_REGISTRY) as FeatureKey[]).map(
    (key) => FEATURE_REGISTRY[key].description
  );

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 pb-20 sm:px-6 sm:py-12"
    >
      <header className="mb-8 grid gap-3">
        <Link href="/" className="flex w-fit items-center text-foreground">
          <Wordmark size={30} />
        </Link>
        <h1 className="font-serif text-[36px] font-normal leading-tight tracking-[-0.005em] sm:text-[42px]">
          A kitchen that remembers what worked
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          The free plan keeps your cooking history forever. Plus adds AI that
          fills in a recipe from a photo, a paste, or a voice note,
          public share links you can send to family, household sharing, and
          planning.
        </p>
      </header>

      <PricingCard
        billingConfigured={billingConfigured}
        launchMode={launchMode}
        authState={authState}
        features={plusFeatures}
      />

      <section className="mt-10 grid gap-3">
        <h2 className="text-lg font-semibold tracking-normal">What&apos;s on the free plan</h2>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li>· Log every meal, with notes and photos</li>
          <li>· Browse and search your full cooking history</li>
          <li>· Rediscovery suggestions on the dashboard</li>
          <li>· One-person household (your own kitchen)</li>
        </ul>
      </section>

      <section className="mt-10 grid gap-4">
        <h2 className="text-lg font-semibold tracking-normal">Common questions</h2>
        <dl className="grid gap-4 text-sm">
          <div className="grid gap-1">
            <dt className="font-medium text-foreground">What does &ldquo;free during launch&rdquo; mean?</dt>
            <dd className="text-muted-foreground">
              Every Plus feature is unlocked for everyone right now — no card
              needed. We&apos;ll give plenty of notice before paid plans begin, and
              early users will get a launch discount as a thank-you. The prices
              above are what they&apos;ll be.
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-foreground">Does Plus apply to the whole household?</dt>
            <dd className="text-muted-foreground">
              Yes — anyone you invite to your household uses Plus features too. One
              account, the whole kitchen benefits.
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
  );
}
