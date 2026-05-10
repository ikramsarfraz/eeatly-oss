import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import {
  ArrowRight,
  Clock3,
  History,
  Lock,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "CookLoop | Remember what to cook next",
  description:
    "CookLoop is a private cooking memory for logging meals, remembering repeats, and rediscovering dinners worth making again."
};

const features = [
  {
    icon: Clock3,
    title: "Log dinner in seconds",
    description: "Capture what you made, when you made it, and the small note that matters next time."
  },
  {
    icon: RotateCcw,
    title: "See reliable repeats",
    description: "CookLoop quietly learns the meals you come back to instead of forcing a meal plan."
  },
  {
    icon: Sparkles,
    title: "Rediscover forgotten favorites",
    description: "Bring back meals you liked but have not cooked in a while."
  }
];

const faqs = [
  {
    question: "Is CookLoop a recipe app?",
    answer:
      "No. It is a memory for meals you already cook, so deciding what to make again is easier."
  },
  {
    question: "Do I need to track nutrition or ingredients?",
    answer:
      "Not yet. Right now CookLoop focuses on fast meal logging, history, and rediscovery."
  },
  {
    question: "Is my cooking history public?",
    answer:
      "No. Your meal history is tied to your account and stays private to you."
  }
];

function DashboardPreview() {
  return (
    <div className="rounded-3xl border bg-card p-3 shadow-xl shadow-primary/10">
      <div className="rounded-2xl border bg-background/80 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tonight</p>
            <h2 className="mt-1 text-xl font-semibold">What should I cook?</h2>
          </div>
          <Badge variant="warm">private beta</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="grid gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Soy ginger noodles</p>
                <p className="text-sm text-muted-foreground">
                  Quick meal idea from your own history.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <History className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Tomato basil eggs</p>
                <p className="text-sm text-muted-foreground">
                  You have not made this in 28 days.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-3 rounded-xl border bg-card p-3">
          <p className="text-sm font-medium">Recent meals</p>
          <div className="mt-3 grid gap-2 text-sm">
            {["Lemon herb chicken bowls", "Crispy rice with tofu", "Mushroom risotto"].map(
              (meal) => (
                <div key={meal} className="flex items-center justify-between rounded-lg bg-muted/60 p-2">
                  <span>{meal}</span>
                  <span className="text-muted-foreground">Log again</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CookLoop",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "A private cooking memory for logging meals and remembering what to cook next."
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-serif italic text-[26px] leading-none text-primary-foreground">
            C
          </span>
          <span className="text-lg font-semibold">CookLoop</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Start free</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_0.95fr] md:items-center md:py-16 lg:px-8">
        <div>
          <Badge variant="secondary">Personal cooking memory</Badge>
          <h1 className="mt-5 font-serif text-4xl tracking-normal sm:text-5xl lg:text-6xl">
            Never wonder what to cook again.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            CookLoop helps you remember the meals worth repeating. Log what you cooked,
            spot your reliable dinners, and rediscover favorites when dinner feels blank.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start your cooking memory
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Your cooking history stays private to your account.
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">The problem</p>
          <h2 className="mt-2 font-serif text-3xl tracking-normal">
            Dinner decisions are hard because your memory is scattered.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Good meals disappear into camera rolls, texts, and vague memories. CookLoop
            gives those meals one calm home so future-you can find them quickly.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="transition-colors hover:bg-muted/30">
                <CardContent className="grid gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-2 lg:px-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-serif text-2xl">Smart resurfacing, not meal planning.</h2>
            <p className="mt-3 text-muted-foreground">
              CookLoop looks at your own history: what you repeat, what is quick, and what
              you have not cooked lately. It suggests from your real life, not a trend feed.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="font-serif text-2xl">Built for quiet trust.</h2>
            <p className="mt-3 text-muted-foreground">
              No public profiles, no social feed, no nutrition pressure. Just your private
              cooking memory, available when you need dinner to feel easier.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl tracking-normal">Questions before you start</h2>
        <div className="mt-5 grid gap-3">
          {faqs.map((faq) => (
            <Card key={faq.question}>
              <CardContent className="p-5">
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>CookLoop helps you remember meals worth making again.</p>
          <div className="flex gap-4">
            <Link href={"/privacy" as Route} className="hover:text-foreground">
              Privacy
            </Link>
            <Link href={"/help" as Route} className="hover:text-foreground">
              Help
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Start free
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
