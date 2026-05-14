import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Camera,
  ChefHat,
  Sparkles,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";

const TAGLINE = "Your family's food memory, kept safe across generations and continents.";
const SUBHEAD =
  "A shared recipe library that connects family across distance — with AI to capture recipes from photos, voice notes, and YouTube videos.";

export const metadata: Metadata = {
  title: "eeatly — Your family's food memory",
  description:
    "A shared recipe library that connects family across distance. Capture recipes from photos, voice notes, YouTube videos, and pasted text. Free for personal use.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "eeatly — Your family's food memory",
    description:
      "A shared recipe library that connects family across distance. Capture recipes from photos, voice notes, YouTube videos, and pasted text.",
    type: "website",
    siteName: "eeatly"
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly — Your family's food memory",
    description:
      "A shared recipe library that connects family across distance."
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
  // "starts at $X" line that doesn't promise a specific number.
  const env = getServerEnv();
  const monthlyPriceDisplay = env.STRIPE_PRICE_MONTHLY_DISPLAY ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eeatly",
    url: env.NEXT_PUBLIC_APP_URL,
    description: SUBHEAD
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

function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_0.9fr] md:items-center md:py-20">
      <div>
        <Badge variant="secondary">For families that cook together</Badge>
        <h1 className="mt-5 font-serif text-[34px] leading-[1.08] tracking-[-0.01em] sm:text-[44px] lg:text-[52px]">
          {TAGLINE}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {SUBHEAD}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {/* Tap targets are >=44px on mobile via the size="lg" + py styles. */}
          <Button asChild size="lg">
            <Link href="/sign-up">
              Sign up free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={"/pricing" as Route}>See pricing</Link>
          </Button>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Free for personal use. No card required to start.
        </p>
      </div>
      <RecipeCardMockup />
    </section>
  );
}

/**
 * Hero visual — a styled mockup using shadcn primitives. Not a real
 * screenshot (the product UI is still moving fast) and deliberately not
 * commissioned art (premature spend). Designed to read as "a recipe card
 * shared inside a kitchen" — the emotional core of the product.
 */
function RecipeCardMockup() {
  return (
    <div className="rounded-3xl border bg-card p-3 shadow-xl shadow-primary/10">
      <div className="rounded-2xl border bg-background p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Sara&apos;s Kitchen
            </p>
            <h2 className="mt-1 font-serif text-2xl">Chicken Karahi</h2>
          </div>
          <Badge variant="warm">Sunday</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Mom said: sear the masala properly before adding water. That&apos;s the
          whole secret.
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-muted/60 p-2.5">
            <span>500g chicken, bone-in</span>
            <span className="text-muted-foreground">Karahi</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/60 p-2.5">
            <span>4 tomatoes, chopped</span>
            <span className="text-muted-foreground">15 min</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/60 p-2.5">
            <span>Ginger-garlic paste, 2 tbsp</span>
            <span className="text-muted-foreground">Hot</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />4 in this kitchen
          </span>
          <span>Cooked 12 times</span>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">
        When your mom shares a recipe over WhatsApp, you&apos;ll never find it
        again three months later.
      </h2>
      <p className="mt-4 text-muted-foreground">
        Family recipes scatter across voice notes, screenshots, and a cousin&apos;s
        Instagram story. eeatly is the calm home for all of it — so the recipe
        you cooked once is still there when you want to cook it again.
      </p>
    </section>
  );
}

const FEATURES = [
  {
    icon: ChefHat,
    title: "Log meals with photos and notes",
    description:
      "Quick logs for everyday cooks. Add a photo and a one-line note; that's enough."
  },
  {
    icon: Sparkles,
    title: "Capture recipes from anywhere",
    description:
      "Snap a photo of a cookbook page, paste a recipe, drop a YouTube link, or record a voice note. AI fills the fields."
  },
  {
    icon: Users,
    title: "Share a kitchen with family",
    description:
      "Invite mom, your partner, the cousins. Everyone's meals show up in one place — async, no real-time required."
  },
  {
    icon: Camera,
    title: "Plan menus for occasions",
    description:
      "Eid, Diwali, Christmas, Thanksgiving — save what worked. Next year, start from last year."
  }
] as const;

function FeaturesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">
        What you can do
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardContent className="grid gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

const HOW_IT_WORKS = [
  { step: "Cook", description: "Make a meal you'll want to remember." },
  {
    step: "Capture",
    description:
      "Snap a photo, record a voice note, or paste the recipe. We fill in the rest."
  },
  {
    step: "Share",
    description:
      "Invite family to your kitchen. Send recipes over WhatsApp with one tap."
  }
] as const;

function HowItWorksSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">
        How it works
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {HOW_IT_WORKS.map((item, i) => (
          <li key={item.step} className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-serif text-xl">{item.step}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PricingTeaser({
  monthlyPriceDisplay
}: {
  monthlyPriceDisplay: string | null;
}) {
  // `monthlyPriceDisplay` is something like "$5" or "$5/mo" — comes from
  // the same env var the /pricing page consumes. If unset, fall back to
  // an honest soft line that doesn't promise a number we can't confirm.
  const priceLine = monthlyPriceDisplay
    ? `Plus features start at ${monthlyPriceDisplay}/month.`
    : "Plus features available on the pricing page.";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Card>
        <CardContent className="grid gap-3 p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl">
              Free for personal use.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {priceLine}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={"/pricing" as Route}>
              See pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

const FAQS = [
  {
    question: "Is eeatly free?",
    answer:
      "Yes — the free plan keeps your full cooking history, supports photo + text logging, and works solo or as a one-person household. Plus features (AI capture from voice / YouTube / photos, multi-member households, public share links, planning) are a paid upgrade."
  },
  {
    question: "Can I use this if I'm not South Asian?",
    answer:
      "Yes. eeatly works for any family that cooks together. The voice-note feature handles Urdu, Hindi, English, and any mix — but English voice notes work just as well, and the product is built around universal patterns: shared kitchens, async cooking, family recipes worth keeping."
  },
  {
    question: "What if my family lives in different time zones?",
    answer:
      "eeatly is async by design. No real-time calls, no presence indicators. Mom in Karachi logs Sunday's biryani while you're asleep in Toronto; you see it when you wake up."
  },
  {
    question: "How does the AI work?",
    answer:
      "On any meal form, tap \"Help me fill this out.\" Four inputs work: photo of a dish or recipe card, pasted text, a YouTube cooking video link, or a recorded/uploaded voice note. The AI fills the form fields — always review before saving."
  },
  {
    question: "How is my data kept private?",
    answer:
      "Only what you log is saved. Audio is processed in-memory and never persisted on our servers. There are no ad cookies or third-party analytics. The privacy page has the full detail."
  }
] as const;

function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">
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
            <p className="mt-3 text-sm text-muted-foreground">{faq.answer}</p>
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

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </span>
          <span>Your family&apos;s food memory.</span>
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
