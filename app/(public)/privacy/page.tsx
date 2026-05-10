import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How CookLoop handles your cooking history and personal information."
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 text-muted-foreground">
        CookLoop is built around one simple idea: your cooking history belongs to you.
        Here is what we save, why, and how it stays yours.
      </p>

      <div className="mt-10 grid gap-10">
        <section>
          <h2 className="text-xl font-semibold">What CookLoop saves</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            When you log a meal, CookLoop saves:
          </p>
          <ul className="mt-2 list-inside list-disc grid gap-1 text-sm text-muted-foreground">
            <li>The meal name you type</li>
            <li>The date you cooked it</li>
            <li>The effort level you pick (quick, easy, medium, or high)</li>
            <li>Any notes you add (optional)</li>
            <li>A photo, if you choose to add one</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            That is everything. We do not track what you search, how long you spend on each
            page, or anything beyond what you choose to log.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Why we save your cooking history</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            CookLoop uses your meal history to do two things: show you what you have cooked
            recently, and surface meals worth repeating when you are not sure what to make.
            Without your history, the app would have nothing useful to show you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Your history is private to you</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your cooking history is tied to your account and only visible to you. We do not
            share it, sell it, or make it visible to anyone else. There are no public
            profiles and no social features.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Feedback you send</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            If you send feedback through the app, a small team may read it to understand
            what is working and what could be better. We treat feedback with care and use
            it only to improve CookLoop. We will not share it publicly or attach it to
            your name without asking.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Questions or concerns</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            If you have a question about your data or want to request that it be removed,
            send us a message through the Feedback button inside the app. We will get back
            to you as soon as we can.
          </p>
        </section>
      </div>
    </div>
  );
}
