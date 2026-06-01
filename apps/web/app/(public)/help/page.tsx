import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Help",
  description:
    "How to log meals, capture recipes from photos / text / voice, save recipe links, share with family, and manage your account."
};

type Topic = {
  question: string;
  /** Rendered as ReactNode so answers can include inline links. */
  answer: React.ReactNode;
};

const topics: Topic[] = [
  {
    question: "How do I log a meal?",
    answer: (
      <>
        Open your dashboard and tap{" "}
        <span className="font-medium text-foreground">Log a meal</span>. Type
        the dish name, pick an effort level (quick, easy, medium, or high),
        choose the date, and add any notes. That&apos;s it — the whole thing
        takes under a minute. If you cooked something you&apos;ve made
        before, use <span className="font-medium text-foreground">Log again</span>{" "}
        from the meal&apos;s detail page to save it with today&apos;s date
        in one tap.
      </>
    )
  },
  {
    question: "How does the AI suggest feature work?",
    answer: (
      <>
        On any meal form, tap{" "}
        <span className="font-medium text-foreground">Help me fill this out</span>.
        Three inputs work:
        <ul className="mt-2 list-inside list-disc grid gap-1">
          <li>
            <span className="text-foreground">Photo</span> — snap the dish
            or a recipe card; we&apos;ll name it and pull the recipe text
            when there is one.
          </li>
          <li>
            <span className="text-foreground">Text</span> — paste a recipe
            or just a paragraph about the dish.
          </li>
          <li>
            <span className="text-foreground">Voice note</span> — record in
            the browser or upload a WhatsApp voice note. Speaking in Urdu,
            Hindi, English, or any mix works.
          </li>
        </ul>
        Saving a recipe from YouTube, TikTok, or Pinterest? Paste the URL
        into the <span className="font-medium text-foreground">Source URL</span>{" "}
        field on the meal form — we&apos;ll embed the video or pin on the
        recipe page so you can play it back when you cook.
        The AI fills the form fields — always review before saving. Your
        voice and audio are processed in-memory and never stored on our
        servers (more in our{" "}
        <Link href={"/privacy" as Route} className="underline underline-offset-4 hover:text-foreground">
          privacy page
        </Link>
        ).
      </>
    )
  },
  {
    question: "How do I share a recipe with someone?",
    answer: (
      <>
        Open the meal&apos;s detail page and tap{" "}
        <span className="font-medium text-foreground">Share</span>. We&apos;ll
        generate a public link you can send over WhatsApp, iMessage, or
        anywhere else. The recipient doesn&apos;t need an eeatly account
        to view it. You can revoke the link any time from the same
        screen.
      </>
    )
  },
  {
    question: "How do I invite my family to my kitchen?",
    answer: (
      <>
        Go to <span className="font-medium text-foreground">Settings</span>{" "}
        and find your kitchen. Tap{" "}
        <span className="font-medium text-foreground">Invite</span>, enter
        an email, and we&apos;ll send them a link. Once they accept, their
        meals show up alongside yours and theirs alongside yours — recipes
        are shared, attribution is preserved.
      </>
    )
  },
  {
    question: "Can I use eeatly if I'm not South Asian?",
    answer: (
      <>
        Yes. eeatly works for any family that cooks together. The product
        is built to feel especially natural for South Asian families
        (Urdu/Hindi voice notes, traditional dish names preserved) but
        nothing about it is exclusive. Western, East Asian, Latin
        American, North African — any family kitchen fits.
      </>
    )
  },
  {
    question: "What if my family lives in a different time zone?",
    answer: (
      <>
        eeatly is async by design — no real-time calls, no presence
        indicators. Mom in Karachi logs Sunday&apos;s biryani while
        you&apos;re asleep in Toronto; you see it when you wake up. The
        whole product is built around &ldquo;kept safe across continents&rdquo;
        as a first principle, not an afterthought.
      </>
    )
  },
  {
    question: "How do I cancel my subscription?",
    answer: (
      <>
        Go to <span className="font-medium text-foreground">Settings → Subscription</span>{" "}
        and tap <span className="font-medium text-foreground">Manage billing</span>.
        That opens the Stripe billing portal where you can cancel, change
        plan, or update your card. Cancellation takes effect at the end of
        your current billing period — you keep Plus features until then.
      </>
    )
  },
  {
    question: "How is my data kept private?",
    answer: (
      <>
        Short version: only what you log is saved, audio is never persisted
        on our servers, and there are no ad cookies or third-party
        analytics. The long version lives on the{" "}
        <Link href={"/privacy" as Route} className="underline underline-offset-4 hover:text-foreground">
          privacy page
        </Link>
        .
      </>
    )
  },
  {
    question: "I found a bug or want to send feedback",
    answer: (
      <>
        Inside the app, tap <span className="font-medium text-foreground">Feedback</span>{" "}
        in the sidebar — we read every message. If you&apos;re not signed
        in yet, the fastest path is to{" "}
        <Link
          href="/sign-up"
          className="underline underline-offset-4 hover:text-foreground"
        >
          create a free account
        </Link>{" "}
        and send the note from inside the app so we can write back.
      </>
    )
  }
];

export default function HelpPage() {
  return (
    <div className="mkt-doc mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-[40px] font-normal" style={{ letterSpacing: "-0.02em" }}>Help</h1>
      <p className="mt-3 text-muted-foreground">
        Short answers to the questions that come up most. If yours
        isn&apos;t here,{" "}
        <Link
          href="/sign-up"
          className="underline underline-offset-4 hover:text-foreground"
        >
          sign up
        </Link>{" "}
        and send us a note from the Feedback button inside the app.
      </p>

      <div className="mt-10 grid gap-6">
        {topics.map((topic) => (
          <div
            key={topic.question}
            className="grid gap-2 border-b pb-6 last:border-b-0 last:pb-0"
          >
            <h2 className="text-lg font-semibold">{topic.question}</h2>
            <div className="text-sm text-muted-foreground">{topic.answer}</div>
          </div>
        ))}
      </div>

      <Card className="mt-10">
        <CardContent className="p-5">
          <p className="text-sm font-medium">See also</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link
              href={"/privacy" as Route}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy
            </Link>{" "}
            ·{" "}
            <Link
              href={"/pricing" as Route}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Pricing
            </Link>{" "}
            ·{" "}
            <Link
              href="/sign-up"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Create your free account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
