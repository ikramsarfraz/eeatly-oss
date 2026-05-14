import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, ChefHat, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  // Signed-in users go straight to the app. Anonymous visitors see the
  // marketing page below.
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  // Pricing teaser pulls from the same env var the /pricing page reads,
  // so the two surfaces can never drift. `null` falls back to a soft
  // "Plus features available" line that doesn't promise a number.
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
    <main id="main" tabIndex={-1} className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">eeatly</span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Sign up free</Link>
          </Button>
        </nav>
      </header>

      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingTeaser monthlyPriceDisplay={monthlyPriceDisplay} />
      <FaqSection />
      <Footer />
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
      {children}
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_0.95fr] md:items-center md:py-20">
      <div>
        <Eyebrow>For families who cook from far apart</Eyebrow>
        <h1 className="mt-4 font-serif text-[34px] leading-[1.05] tracking-[-0.01em] sm:text-[44px] lg:text-[52px]">
          {HEADLINE}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {SUBHEAD}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {/* Tap targets are >=44px on mobile via the size="lg" + py styles. */}
          <Button asChild size="lg">
            <Link href="/sign-up">
              Start your kitchen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={"/pricing" as Route}>See pricing</Link>
          </Button>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Free to start. Invite family anytime.
        </p>
      </div>
      <RecipeCardMockup />
    </section>
  );
}

/**
 * Hero visual — single styled card built from Tailwind primitives. Reads
 * as "a recipe card shared inside a shared kitchen, captured from a voice
 * note, ready to send out via WhatsApp" — the four product anchors in
 * one image. No third-party brand marks beyond the literal text
 * "WhatsApp" in the share button copy.
 */
function RecipeCardMockup() {
  return (
    <div className="rounded-3xl border bg-card p-3 shadow-xl shadow-primary/10">
      <div className="rounded-2xl border bg-background p-5">
        {/* Top row: "Recipe" eyebrow + member avatar stack */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Recipe
          </p>
          <KitchenMemberStack />
        </div>

        {/* Title */}
        <h2 className="mt-3 font-serif text-[26px] leading-tight tracking-[-0.005em] sm:text-[28px]">
          Chicken Karahi
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Added by Ammi · 3 weeks ago
        </p>

        {/* "From voice note" pill */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11.5px] font-medium text-foreground">
          <Mic className="h-3 w-3" />
          From voice note
        </div>

        {/* Subtle footnote */}
        <p className="mt-4 text-[12.5px] text-muted-foreground">
          Tested 4 times · Last cooked for Eid
        </p>

        {/* Share to WhatsApp button — green-tinted, no third-party logo */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          Share to WhatsApp
        </button>
      </div>
    </div>
  );
}

/**
 * Overlapping avatar stack — plain styled divs (not the Radix Avatar
 * primitive) so the page stays a server component. Initials only; no
 * photos. The "+1" pill caps the visible count at 4.
 */
function KitchenMemberStack() {
  const initials = ["S", "M", "A", "Z"];
  return (
    <div className="flex items-center -space-x-2">
      {initials.map((initial, i) => (
        <span
          key={initial}
          className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-secondary text-[11px] font-semibold text-secondary-foreground"
          style={{ zIndex: initials.length - i }}
          aria-hidden="true"
        >
          {initial}
        </span>
      ))}
      <span className="ml-1 grid h-7 min-w-[1.75rem] place-items-center rounded-full border-2 border-background bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
        +1
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>The recipes you love don&apos;t survive</Eyebrow>
      <h2 className="mt-4 font-serif text-2xl leading-[1.15] sm:text-3xl">
        Good recipes get lost. Always.
      </h2>
      <p className="mt-5 text-muted-foreground">
        Mom sends the recipe over WhatsApp. You scroll past it. Three months
        later you want it back, and it&apos;s buried in a chat with four
        thousand messages. Your sister texts you a photo of the spice ratio
        — your camera roll eats it. You make something amazing for Eid, and
        by next year, you can&apos;t remember exactly what you did.
      </p>
      <p className="mt-4 text-muted-foreground">
        Family recipes shouldn&apos;t be this fragile. eeatly keeps them —
        across phones, across chats, across continents.
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    title: "Save recipes however they reach you.",
    description:
      "A photo of mom's handwritten notes. A voice note explaining the method. A YouTube video your aunt sent. A text dump. eeatly reads all of them and saves the recipe clean — title, ingredients, steps, the tip you don't want to lose."
  },
  {
    title: "One kitchen for your whole family.",
    description:
      "Invite mom, your sister, your daughter, your cousin. Everyone's recipes in one shared library. Every dish credited to whoever added it."
  },
  {
    title: "Plan the meals that matter.",
    description:
      "Eid menu. Diwali dinner. Sunday rotation. Whatever your family's calendar looks like. Build a plan once, and next year's plan carries forward last year's notes — what worked, what didn't, who liked what."
  },
  {
    title: "Share a recipe with anyone.",
    description:
      "One link. Works in WhatsApp, text, anywhere. The person you send it to doesn't need an account to see it. Revoke the link whenever you want it private again."
  }
] as const;

function FeaturesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Eyebrow>What you can do</Eyebrow>
      <h2 className="mt-4 font-serif text-2xl leading-[1.15] sm:text-3xl">
        Built around how recipes actually move through families.
      </h2>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardContent className="grid gap-3 p-5">
              <h3 className="font-serif text-lg">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

const HOW_IT_WORKS = [
  {
    step: "Cook something worth keeping.",
    description: "The everyday meal or the Eid showstopper."
  },
  {
    step: "Save it before you forget.",
    description: "Photo, voice note, pasted text, YouTube link. Done in under a minute."
  },
  {
    step: "Find it when you need it.",
    description: "By name, by season, by who added it last. Share it when family asks."
  }
] as const;

function HowItWorksSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Eyebrow>Three steps</Eyebrow>
      <h2 className="mt-4 font-serif text-2xl leading-[1.15] sm:text-3xl">
        Cook. Save. Find again.
      </h2>
      <ol className="mt-7 grid gap-5 sm:grid-cols-3">
        {HOW_IT_WORKS.map((item, i) => (
          <li key={item.step} className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-serif text-lg leading-tight">{item.step}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PricingTeaser({
  monthlyPriceDisplay
}: {
  monthlyPriceDisplay: string | null;
}) {
  // `monthlyPriceDisplay` is something like "$5" or "$5/mo" — comes from
  // the same env var the /pricing page consumes. If unset, fall back to
  // an honest soft line that doesn't promise a number we can't confirm.
  const priceSentence = monthlyPriceDisplay
    ? `Starts at ${monthlyPriceDisplay}/month.`
    : "See the pricing page for the latest.";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:p-8">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="font-serif text-2xl leading-[1.15] sm:text-3xl">
            Free for personal use. Plus for the whole family.
          </h2>
          <p className="text-muted-foreground">
            Log meals, save photos, and search your own kitchen — free,
            forever. Plus unlocks AI capture (photo, text, voice, YouTube),
            shared family kitchens, occasion planning, and public share
            links. {priceSentence}
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href={"/pricing" as Route}>
                See full pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

type FaqItem = {
  question: string;
  /** Rendered as ReactNode so we can inline a typed link to /privacy. */
  answer: React.ReactNode;
};

const FAQS: readonly FaqItem[] = [
  {
    question: "Is eeatly just for South Asian families?",
    answer:
      "No. eeatly works for any family that cooks together. We talk about WhatsApp voice notes and Eid menus because that's the experience the product was built around — but every family has a version of this. Grandma's pie crust. Your dad's chili. The pasta sauce your roommate's mom taught you."
  },
  {
    question: "What about family members who aren't tech-comfortable?",
    answer:
      "We designed for the parent or grandparent who isn't a power user. No passwords — just a sign-in link to their email. They can save recipes by speaking into a voice note or photographing handwritten ones. The hardest thing they'll do is tap \"accept invitation.\""
  },
  {
    question: "What happens to recipes if someone leaves the kitchen?",
    answer:
      "Their contributions stay. The kitchen credits them as \"Former member\" — but no recipes disappear when someone removes their account. Family memory shouldn't depend on whether someone still has the app installed."
  },
  {
    question: "What is the AI actually doing with my photos and voice notes?",
    answer: (
      <>
        When you save a recipe from a photo, voice note, YouTube link, or
        pasted text, we send the input to a third-party AI service (OpenAI
        for transcription, OpenAI or Anthropic for extraction). We don&apos;t
        keep your audio. We don&apos;t keep the transcripts. The cleaned
        recipe is what gets saved; the rest is discarded after processing.
        Full details on our{" "}
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
    question: "Can I share a recipe with people outside my family kitchen?",
    answer:
      "Yes. Generate a link for any recipe, send it via WhatsApp or text. They can view it without signing up. You can revoke the link anytime."
  },
  {
    question: "My \"kitchen\" is just me. Does eeatly still help?",
    answer:
      "Yes. The personal-cooking-memory part of the product works on its own. Many people use eeatly solo and never invite anyone. The family features are there when you want them — never required."
  }
];

function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Questions</Eyebrow>
      <h2 className="mt-4 font-serif text-2xl leading-[1.15] sm:text-3xl">
        Common questions
      </h2>
      <div className="mt-6 grid gap-2">
        {FAQS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-xl border bg-card p-4 transition-colors open:bg-muted/30"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-base font-medium [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span className="text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 text-sm text-muted-foreground">{faq.answer}</div>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        More on the{" "}
        <Link
          href={"/help" as Route}
          className="underline underline-offset-4 hover:text-foreground"
        >
          help page
        </Link>
        .
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </span>
          <span>Where your family&apos;s recipes live.</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href={"/pricing" as Route} className="hover:text-foreground">
            Pricing
          </Link>
          <Link href={"/privacy" as Route} className="hover:text-foreground">
            Privacy
          </Link>
          <Link href={"/help" as Route} className="hover:text-foreground">
            Help
          </Link>
          <Link href="/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
