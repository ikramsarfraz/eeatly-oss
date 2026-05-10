import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Help",
  description: "Learn how to use CookLoop to remember and rediscover your meals."
};

const topics = [
  {
    question: "What is CookLoop?",
    answer:
      "CookLoop is a personal cooking memory. It helps you remember what you have cooked, notice which meals you come back to most, and rediscover dinners you have not made in a while. It is not a recipe app — it is a memory for the meals you already cook."
  },
  {
    question: "How do I log a meal?",
    answer:
      'Tap "Log a meal" in the sidebar or use the ⌘N shortcut on a keyboard. Type the meal name, pick an effort level (quick, easy, medium, or high), choose the date, and add any notes you want to remember. Tap "Log meal" and you are done. The whole thing takes under a minute.'
  },
  {
    question: 'What does "Log again" do?',
    answer:
      '"Log again" is a shortcut for meals you have cooked before. It saves the meal with today\'s date and the same effort level as last time. Use it when you make the same thing again and do not want to type anything new.'
  },
  {
    question: "How do suggestions work?",
    answer:
      "CookLoop looks at your own meal history to suggest what to cook tonight. It considers meals you have not made in a while, meals you cook often, and meals that do not take much effort. Everything it suggests comes from your own history — not a recipe database or trend list."
  },
  {
    question: "How do I send feedback?",
    answer:
      'Tap "Feedback" in the sidebar, or open it from the Settings page. Tell us what felt confusing, broken, or missing. You can also send a quick note to say something is working well. We read every message.'
  },
  {
    question: "How do I sign out?",
    answer:
      'Go to Settings (in the sidebar under "You"), scroll to the bottom, and tap "Sign out." This signs you out on this device only. Your cooking history stays saved to your account.'
  }
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Help</h1>
      <p className="mt-3 text-muted-foreground">
        New to CookLoop? Here is what you need to know.
      </p>

      <div className="mt-10 grid gap-6">
        {topics.map((topic) => (
          <div key={topic.question} className="grid gap-2 border-b pb-6 last:border-b-0 last:pb-0">
            <h2 className="text-lg font-semibold">{topic.question}</h2>
            <p className="text-sm text-muted-foreground">{topic.answer}</p>
          </div>
        ))}
      </div>

      <Card className="mt-10">
        <CardContent className="p-5">
          <p className="text-sm font-medium">Still stuck?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send us a message through the Feedback button in the app. If you are not signed
            in yet,{" "}
            <Link
              href="/sign-up"
              className="underline underline-offset-4 hover:text-foreground"
            >
              create your free account
            </Link>{" "}
            and then use Feedback from the sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
