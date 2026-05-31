import Link from "next/link";
import type { Metadata, Route } from "next";
import { Sparkles } from "lucide-react";
import { getServerEnv } from "@/lib/env/server";
import {
  getPlanShareByToken,
  getRecipeShareByToken,
  type PublicPlanView
} from "@/services/shares";

export const dynamic = "force-dynamic";

/**
 * Round 7 — public recipe share page. SERVER-RENDERED so WhatsApp /
 * iMessage previews see the right OG tags and Google indexes the
 * Recipe schema markup. NO auth check. The token is the access.
 *
 * Layout choices are mobile-first because that's where the page is
 * mostly opened (link tap in WhatsApp → in-app browser → here).
 */

function buildShareUrl(token: string): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/share/${token}`;
}

function truncateForDescription(text: string | null): string {
  if (!text) return "Saved on eeatly.";
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= 160) return single;
  return single.slice(0, 157) + "…";
}

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  const share = await getRecipeShareByToken({ token });
  const canonicalUrl = buildShareUrl(token);

  if (!share) {
    const plan = await getPlanShareByToken({ token });
    if (plan) {
      const planTitle = `${plan.planName} · eeatly`;
      const planDesc = `A meal plan with ${plan.dishes.length} ${
        plan.dishes.length === 1 ? "dish" : "dishes"
      }, shared from ${plan.householdName}.`;
      return {
        title: planTitle,
        description: planDesc,
        alternates: { canonical: canonicalUrl },
        openGraph: {
          type: "website",
          title: planTitle,
          description: planDesc,
          url: canonicalUrl,
          siteName: "eeatly"
        }
      };
    }
    return {
      title: "No longer shared — eeatly",
      // Prevent indexing of the dead-link page; live shares stay
      // indexable by default.
      robots: { index: false, follow: false }
    };
  }

  const title = `${share.mealName} · eeatly`;
  const description = truncateForDescription(share.recipeText);
  const imageUrl = share.photoUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonicalUrl,
      siteName: "eeatly",
      images: imageUrl ? [{ url: imageUrl, alt: share.mealName }] : undefined
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined
    }
  };
}

export default async function PublicSharePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const share = await getRecipeShareByToken({ token });

  if (!share) {
    // Not a recipe share — try a plan share before giving up.
    const plan = await getPlanShareByToken({ token });
    if (plan) return <PlanShareView plan={plan} token={token} />;

    // Custom "no longer shared" surface — friendlier than the generic
    // 404 (the URL was legitimate at some point; the share was just
    // revoked or the item deleted).
    return (
      <section className="mx-auto grid max-w-2xl gap-4 px-4 py-12 sm:px-6">
        <h1 className="font-serif text-[32px] font-normal leading-tight">
          This is no longer shared
        </h1>
        <p className="text-sm text-muted-foreground">
          The link may have been revoked, or the item was deleted. Ask whoever
          sent the link to share a fresh one.
        </p>
        <div>
          <Link
            href={"/" as Route}
            className="text-sm font-medium text-primary hover:underline"
          >
            What is eeatly? →
          </Link>
        </div>
      </section>
    );
  }

  const canonicalUrl = buildShareUrl(token);

  // Schema.org Recipe JSON-LD for Google rich-results indexing. Minimal
  // payload (name + image + author + description) — parsing ingredients
  // and instructions out of free-form recipe text is fiddly enough that
  // the spec said to ship minimal if needed. Future work: a recipe
  // parser that fills `recipeIngredient` + `recipeInstructions`.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: share.mealName,
    description: truncateForDescription(share.recipeText),
    ...(share.photoUrl ? { image: share.photoUrl } : {}),
    author: {
      "@type": "Organization",
      name: share.householdName
    },
    datePublished: share.createdAt.toISOString(),
    url: canonicalUrl
  };

  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        // Recipe schema is the whole point of server-rendering the page.
        // dangerouslySetInnerHTML is the documented way to ship JSON-LD
        // in Next; the payload is server-built from typed fields so XSS
        // surface is bounded.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="grid gap-2">
        <h1 className="font-serif text-[32px] font-normal leading-tight tracking-[-0.005em] sm:text-[36px]">
          {share.mealName}
        </h1>
        <p className="text-xs text-muted-foreground">
          Saved in <strong className="text-foreground">{share.householdName}</strong>
        </p>
      </header>

      {share.photoUrl ? (
        // Plain <img> per project policy (no next/image — fewer surprises
        // with R2 URLs). The photo is already public; serving direct
        // from R2 saves a round-trip through our origin.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={share.photoUrl}
          alt={share.mealName}
          className="aspect-[4/3] w-full rounded-xl border bg-muted object-cover"
          loading="lazy"
        />
      ) : null}

      <section className="grid gap-3">
        {share.recipeText ? (
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-[1.55] text-foreground">
            {share.recipeText}
          </pre>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No recipe text saved for this meal yet.
          </p>
        )}
        {share.recipeSourceUrl ? (
          <p className="text-xs text-muted-foreground">
            Source:{" "}
            <a
              href={share.recipeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {share.recipeSourceUrl}
            </a>
          </p>
        ) : null}
      </section>

      <aside className="mt-2 grid gap-3 rounded-xl border bg-background/60 p-4 sm:flex sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Save this recipe to your own journal
          </p>
          <p className="text-xs text-muted-foreground">
            eeatly remembers what you cook, suggests what to make next, and lets
            your household plan together.
          </p>
        </div>
        <Link
          href={`/sign-up?next=/share/${encodeURIComponent(token)}/save` as Route}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start free
        </Link>
      </aside>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Saved in {share.householdName} · eeatly.app
      </p>
    </article>
  );
}

/** Public read-only render of a shared plan (no auth). */
function PlanShareView({ plan, token }: { plan: PublicPlanView; token: string }) {
  const dateLabel = plan.scheduledDate
    ? new Date(plan.scheduledDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    : null;
  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <header className="grid gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Plan{dateLabel ? ` · ${dateLabel}` : ""}
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-tight tracking-[-0.005em] sm:text-[36px]">
          {plan.planName}
        </h1>
        <p className="text-xs text-muted-foreground">
          Shared from <strong className="text-foreground">{plan.householdName}</strong> ·{" "}
          {plan.dishes.length} {plan.dishes.length === 1 ? "dish" : "dishes"}
        </p>
      </header>

      {plan.notes ? (
        <p className="text-[15px] leading-[1.55] text-foreground">{plan.notes}</p>
      ) : null}

      <section className="grid gap-2">
        {plan.dishes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No dishes on this plan yet.</p>
        ) : (
          <ul className="grid gap-2">
            {plan.dishes.map((dish, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border bg-background/60 p-2.5"
              >
                {dish.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dish.photoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md border bg-muted object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted font-serif text-lg text-muted-foreground">
                    {(dish.name.trim()[0] ?? "·").toUpperCase()}
                  </span>
                )}
                <span className="text-[15px] font-medium text-foreground">{dish.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs italic text-muted-foreground">
          Recipes aren&apos;t shared with this plan link — only the menu.
        </p>
      </section>

      <aside className="mt-2 grid gap-3 rounded-xl border bg-background/60 p-4 sm:flex sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Plan your own menus on eeatly
          </p>
          <p className="text-xs text-muted-foreground">
            eeatly remembers what you cook, suggests what to make next, and lets you plan and
            share with the people you cook with.
          </p>
        </div>
        <Link
          href={`/sign-up?next=/share/${encodeURIComponent(token)}` as Route}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start free
        </Link>
      </aside>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Shared from {plan.householdName} · eeatly.app
      </p>
    </article>
  );
}
