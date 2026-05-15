import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What eeatly collects, how AI processing works, what gets shared in a kitchen, and how to delete your account."
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 text-muted-foreground">
        eeatly is your family&apos;s food memory, and you should know exactly
        how it&apos;s kept. This page is in plain English, not legal
        boilerplate. If something here is unclear, let us know through{" "}
        <Link href={"/help" as Route} className="underline underline-offset-4 hover:text-foreground">
          Help
        </Link>{" "}
        and we&apos;ll fix the wording.
      </p>

      <div className="mt-10 grid gap-10">
        <section>
          <h2 className="text-xl font-semibold">What we collect</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Only the things you put in:
          </p>
          <ul className="mt-2 list-inside list-disc grid gap-1 text-sm text-muted-foreground">
            <li>Your account info — email and the name you sign up with</li>
            <li>Meals you log — name, date, effort, notes</li>
            <li>Photos you upload (optional)</li>
            <li>Audio you record or upload for voice notes (see &ldquo;AI processing&rdquo; below)</li>
            <li>Which kitchen you belong to and who else is in it</li>
            <li>Recipes you save and any shareable links you create</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            We don&apos;t track what you search, how long you spend on each
            page, or anything beyond what you choose to log. There are no
            third-party analytics on the site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Where your data lives</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account, meals, recipes, and household info live in a
            managed Postgres database (Neon). Photos you upload live in
            object storage (Cloudflare R2). Payment info — only if you upgrade
            to a paid plan — is handled entirely by Stripe; we never see your
            card details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">AI processing</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            When you use the AI suggest feature — to fill a meal from a photo,
            pasted text, or a voice note — your input is sent to an AI
            provider (OpenAI primary, Anthropic as a fallback) to extract the
            recipe. Two specifics worth being explicit about:
          </p>
          <ul className="mt-2 list-inside list-disc grid gap-1 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">Audio is not persisted on our servers.</span>{" "}
              Voice notes are sent directly to the transcription provider,
              transcribed in-memory, and discarded. We never write the audio
              bytes to disk.
            </li>
            <li>
              <span className="text-foreground">Transcripts and AI outputs aren&apos;t persisted</span>{" "}
              beyond what shows up in your meal record. The intermediate
              data the AI generates while extracting your recipe isn&apos;t
              stored separately.
            </li>
            <li>
              The AI providers process your input under their own terms.
              Anthropic and OpenAI don&apos;t train their public models on
              API-submitted data by default.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            If you&apos;d rather not send your data to a third-party AI
            provider, you can ignore the AI suggest feature entirely —
            everything in eeatly works without it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Shared kitchens</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            When you join a kitchen with family, members see each
            other&apos;s meals, recipes, and plans. Each cook&apos;s
            attribution is preserved (&ldquo;Sara cooked this&rdquo;) so
            you can tell whose recipe is whose.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            If a member leaves the kitchen or deletes their account, the
            meals they logged stay with the household but their
            attribution becomes &ldquo;Former member&rdquo; — their name
            and email come off. The history doesn&apos;t disappear; the
            personal identifier does.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Recipe shares</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            When you create a public share link for a recipe, anyone with
            that link can view the recipe (no sign-in required). Share
            links are unlisted — they aren&apos;t indexed or made
            findable — but they&apos;re not secret either. You can revoke
            a share link at any time from the recipe&apos;s settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Deleting your account</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            You can delete your account from Settings. When you do:
          </p>
          <ul className="mt-2 list-inside list-disc grid gap-1 text-sm text-muted-foreground">
            <li>Your account info (name, email, profile) is removed.</li>
            <li>
              If you&apos;re the only member of your kitchen, the kitchen and
              all meals/recipes in it are removed too.
            </li>
            <li>
              If you&apos;re part of a shared kitchen, your meals stay with
              the household as described above — your name comes off, but
              the cooking history doesn&apos;t.
            </li>
            <li>
              Aggregated, deidentified analytics events stay so our totals
              don&apos;t suddenly look wrong, but they no longer reference
              you.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Deletion is immediate. We send a confirmation email so you have
            a record of the request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Cookies</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We use one cookie: the session cookie that keeps you signed in
            after you click a magic link. No ad cookies, no tracking
            pixels, no third-party analytics.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Feedback we receive</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            If you send feedback through the app, a small team reads it.
            We use it to fix things and improve the product — never publicly,
            and never attached to your name without asking.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Questions</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            For data requests, account questions, or anything else, send a
            message through the Feedback button in the app. If you&apos;re
            not signed in, get in touch from the{" "}
            <Link href={"/help" as Route} className="underline underline-offset-4 hover:text-foreground">
              Help
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    </div>
  );
}
