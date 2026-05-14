import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChefHat,
  Mic,
  Camera,
  Users,
  CalendarDays,
  Share2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";

const HEADLINE = "One kitchen. Your whole family. Any distance.";
const SUBHEAD =
  "Save the recipes your family actually cooks — from voice notes, WhatsApp photos, YouTube videos, however they reach you. Everyone in your kitchen can see them, even when you're not in the same one.";
const META_DESCRIPTION =
  "Save the family recipes that matter — from voice notes, WhatsApp photos, YouTube videos, however they reach you. Shared kitchens across continents.";

export const metadata: Metadata = {
  title: "eeatly — One kitchen for your whole family",
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "eeatly — One kitchen for your whole family",
    description: META_DESCRIPTION,
    type: "website",
    siteName: "eeatly"
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly — One kitchen for your whole family",
    description: META_DESCRIPTION
  }
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const env = getServerEnv();
  const monthlyPriceDisplay = env.STRIPE_PRICE_MONTHLY_DISPLAY ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eeatly",
    url: env.NEXT_PUBLIC_APP_URL,
    description: META_DESCRIPTION
  };

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Header />
      <HeroSection />
      <SocialProof />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SecondaryCTA />
      <PricingTeaser monthlyPriceDisplay={monthlyPriceDisplay} />
      <FaqSection />
      <Footer />
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">eeatly</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={"/pricing" as Route}>Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
      {children}
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-16 md:py-24 lg:py-28">
        <div className="max-w-xl">
          <Eyebrow>For families who cook from far apart</Eyebrow>
          <h1 className="mt-5 text-balance font-serif text-[36px] leading-[1.08] tracking-[-0.015em] sm:text-[48px] lg:text-[56px]">
            {HEADLINE}
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {SUBHEAD}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gap-2 shadow-md shadow-primary/20">
              <Link href="/sign-up">
                Start your kitchen
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href={"/pricing" as Route}>See pricing</Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Free to start · No credit card required
          </p>
        </div>

        <RecipeCardMockup />
      </div>
    </section>
  );
}

/**
 * Hero visual — single styled card built from Tailwind primitives.
 */
function RecipeCardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
      {/* Decorative background glow */}
      <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-2xl" />

      <div className="relative rounded-3xl border bg-card p-3 shadow-xl shadow-primary/10">
        <div className="rounded-2xl border bg-background p-5 sm:p-6">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Recipe
            </p>
            <KitchenMemberStack />
          </div>

          {/* Title */}
          <h2 className="mt-4 font-serif text-[26px] leading-tight tracking-[-0.005em] sm:text-[30px]">
            Chicken Karahi
          </h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Added by Ammi · 3 weeks ago
          </p>

          {/* "From voice note" pill */}
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
            <Mic className="h-3.5 w-3.5 text-primary" />
            From voice note
          </div>

          {/* Subtle footnote */}
          <p className="mt-5 text-[13px] text-muted-foreground">
            Tested 4 times · Last cooked for Eid
          </p>

          {/* Share to WhatsApp button */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Share to WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function KitchenMemberStack() {
  const initials = ["S", "M", "A", "Z"];
  return (
    <div className="flex items-center -space-x-2">
      {initials.map((initial, i) => (
        <span
          key={initial}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-secondary text-[11px] font-semibold text-secondary-foreground shadow-sm"
          style={{ zIndex: initials.length - i }}
          aria-hidden="true"
        >
          {initial}
        </span>
      ))}
      <span className="ml-1 grid h-8 min-w-8 place-items-center rounded-full border-2 border-background bg-muted px-2 text-[11px] font-medium text-muted-foreground">
        +1
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SocialProof() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 text-center text-sm text-muted-foreground sm:px-6">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-3 w-3 text-primary" />
          </span>
          Families across 15+ countries
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span>2,500+ recipes saved</span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span>No recipes lost. Ever.</span>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:py-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground/70">
            The recipes you love don&apos;t survive
          </p>
          <h2 className="mt-4 font-serif text-[28px] leading-[1.15] sm:text-[36px]">
            Good recipes get lost. Always.
          </h2>
        </div>
        <div className="space-y-4 text-background/80">
          <p>
            Mom sends the recipe over WhatsApp. You scroll past it. Three months
            later you want it back, and it&apos;s buried in a chat with four
            thousand messages.
          </p>
          <p>
            Your sister texts you a photo of the spice ratio — your camera roll
            eats it. You make something amazing for Eid, and by next year, you
            can&apos;t remember exactly what you did.
          </p>
          <p className="font-medium text-background">
            Family recipes shouldn&apos;t be this fragile. eeatly keeps them —
            across phones, across chats, across continents.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Camera,
    title: "Save recipes however they reach you",
    description:
      "A photo of mom's handwritten notes. A voice note explaining the method. A YouTube video your aunt sent. eeatly reads all of them and saves the recipe clean.",
    highlight: true
  },
  {
    icon: Users,
    title: "One kitchen for your whole family",
    description:
      "Invite mom, your sister, your daughter. Everyone's recipes in one shared library. Every dish credited to whoever added it."
  },
  {
    icon: CalendarDays,
    title: "Plan the meals that matter",
    description:
      "Eid menu. Diwali dinner. Sunday rotation. Build a plan once, and next year's plan carries forward last year's notes."
  },
  {
    icon: Share2,
    title: "Share a recipe with anyone",
    description:
      "One link. Works in WhatsApp, text, anywhere. No account needed to view. Revoke the link whenever you want it private again."
  }
] as const;

function FeaturesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>What you can do</Eyebrow>
        <h2 className="mt-4 text-balance font-serif text-[28px] leading-[1.15] sm:text-[36px]">
          Built around how recipes actually move through families
        </h2>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className={`group relative overflow-hidden rounded-2xl border p-6 transition-colors hover:border-primary/30 sm:p-8 ${
              feature.highlight
                ? "bg-gradient-to-br from-primary/5 to-transparent sm:col-span-2 sm:grid sm:grid-cols-2 sm:items-center sm:gap-8"
                : "bg-card"
            }`}
          >
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-serif text-xl leading-tight sm:text-2xl">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
            {feature.highlight && (
              <div className="mt-6 sm:mt-0">
                <FeatureIllustration />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureIllustration() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { icon: Camera, label: "Photo" },
        { icon: Mic, label: "Voice" },
        { icon: Share2, label: "Link" }
      ].map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center"
        >
          <item.icon className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

const HOW_IT_WORKS = [
  {
    step: "Cook something worth keeping",
    description: "The everyday meal or the Eid showstopper."
  },
  {
    step: "Save it before you forget",
    description: "Photo, voice note, pasted text, YouTube link. Done in under a minute."
  },
  {
    step: "Find it when you need it",
    description: "By name, by season, by who added it. Share it when family asks."
  }
] as const;

function HowItWorksSection() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Three steps</Eyebrow>
          <h2 className="mt-4 text-balance font-serif text-[28px] leading-[1.15] sm:text-[36px]">
            Cook. Save. Find again.
          </h2>
        </div>

        <ol className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3 md:gap-4 lg:mt-16">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.step} className="relative text-center md:text-left">
              {/* Connector line (hidden on mobile and last item) */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="absolute left-1/2 top-6 hidden h-px w-full -translate-x-1/2 translate-y-1/2 bg-border md:left-[calc(50%+2rem)] md:block md:w-[calc(100%-4rem)]" />
              )}

              <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background text-lg font-semibold text-primary md:mx-0">
                {i + 1}
              </div>
              <h3 className="mt-5 font-serif text-lg leading-tight">{item.step}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SecondaryCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-serif text-[28px] leading-[1.15] sm:text-[36px]">
          Your family&apos;s recipes deserve better than a chat archive
        </h2>
        <p className="mt-4 text-muted-foreground">
          Start preserving them today. It takes less than a minute to save your
          first recipe.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="gap-2 shadow-md shadow-primary/20">
            <Link href="/sign-up">
              Start your kitchen — it&apos;s free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PricingTeaser({
  monthlyPriceDisplay
}: {
  monthlyPriceDisplay: string | null;
}) {
  const priceSentence = monthlyPriceDisplay
    ? `Starts at ${monthlyPriceDisplay}/month.`
    : "See the pricing page for the latest.";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-card to-muted/30 p-8 sm:p-12 md:p-16">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2 md:items-center md:gap-12">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 font-serif text-[26px] leading-[1.15] sm:text-[32px]">
              Free for personal use. Plus for the whole family.
            </h2>
          </div>
          <div>
            <p className="text-muted-foreground">
              Log meals, save photos, and search your own kitchen — free,
              forever. Plus unlocks AI capture, shared family kitchens, occasion
              planning, and public share links. {priceSentence}
            </p>
            <div className="mt-6">
              <Button asChild variant="outline" className="gap-2">
                <Link href={"/pricing" as Route}>
                  See full pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

type FaqItem = {
  question: string;
  answer: React.ReactNode;
};

const FAQS: readonly FaqItem[] = [
  {
    question: "Is eeatly just for South Asian families?",
    answer:
      "No. eeatly works for any family that cooks together. We talk about WhatsApp voice notes and Eid menus because that's the experience the product was built around — but every family has a version of this."
  },
  {
    question: "What about family members who aren't tech-comfortable?",
    answer:
      "We designed for the parent or grandparent who isn't a power user. No passwords — just a sign-in link to their email. They can save recipes by speaking into a voice note or photographing handwritten ones."
  },
  {
    question: "What happens to recipes if someone leaves the kitchen?",
    answer:
      "Their contributions stay. The kitchen credits them as \"Former member\" — but no recipes disappear when someone removes their account."
  },
  {
    question: "What is the AI actually doing with my photos and voice notes?",
    answer: (
      <>
        When you save a recipe from a photo, voice note, or YouTube link, we send
        the input to a third-party AI service for processing. We don&apos;t keep
        your audio or transcripts. Full details on our{" "}
        <Link
          href={"/privacy" as Route}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Privacy page
        </Link>
        .
      </>
    )
  },
  {
    question: "My \"kitchen\" is just me. Does eeatly still help?",
    answer:
      "Yes. The personal-cooking-memory part of the product works on its own. Many people use eeatly solo and never invite anyone."
  }
];

function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <div className="text-center">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-4 font-serif text-[28px] leading-[1.15] sm:text-[36px]">
          Common questions
        </h2>
      </div>

      <div className="mt-10 grid gap-3">
        {FAQS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-xl border bg-card transition-colors open:bg-muted/30"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        More questions?{" "}
        <Link
          href={"/help" as Route}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Visit our help center
        </Link>
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-start md:py-16">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">eeatly</span>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Where your family&apos;s recipes live. Across phones, across chats,
            across continents.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
          <Link href={"/pricing" as Route} className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href={"/privacy" as Route} className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
          <Link href={"/help" as Route} className="text-muted-foreground hover:text-foreground">
            Help
          </Link>
          <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} eeatly</span>
          <span>Made for families who cook apart</span>
        </div>
      </div>
    </footer>
  );
}
