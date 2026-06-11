"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Archive, Camera, Loader2, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealTile } from "@/components/ui/meal-tile";
import { WhoCanSeeStrip } from "@/components/sharing/who-can-see-strip";
import { SectionLabel } from "@/components/ui/section-label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

import { IngredientChecklist } from "@/components/meals/ingredient-checklist";
import { StepCard, type StepCardData } from "@/components/meals/step-card";
import { StructuredIngredientList } from "@/components/meals/structured-ingredient-list";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { GenerateImageButton } from "@/components/credits/generate-image-button";
import { SourceUrlEmbed } from "@/components/embeds/source-url-embed";
import { useRecipeLifecycle } from "@/components/meals/use-recipe-lifecycle";

import { useToast } from "@/components/providers/toast-provider";
import { useSetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { splitMealName } from "@/lib/meal/split-name";
import { trpc } from "@/lib/trpc/client";
import { uploadPhoto } from "@/lib/uploads/upload-photo";
import { cn } from "@/lib/utils";

/**
 * Round 27 — editorial Recipe Detail client renderer.
 *
 * Replaces R25's utility-first two-column sticky-sidebar layout with
 * the design's two stacked full-bleed bands: a hero (square monogram
 * tile + split editorial title + chip row + meta line) above a body
 * (cream-soft ingredient sidebar + recipe steps column).
 *
 * Why this is a client component:
 *   - The R26 TopBar actions slot is populated via the
 *     `useSetTopBarActions(node)` hook, which only runs in client
 *     components. The recipe page needs to register a "Refine with AI"
 *     + "Log a cook" pair, so the rendering moves here while the
 *     surrounding page.tsx stays server-rendered (it still owns the
 *     auth gate + service fetch).
 *
 * Reuses unchanged from R25:
 *   - `<MealTile>` (palette + monogram). Square corners via
 *     `className="rounded-none"` — `cn()` uses tailwind-merge so the
 *     passed class wins over the component's internal `rounded-xl`.
 *   - `<StructuredIngredientList>` (same API, visual retune in
 *     `structured-ingredient-list.tsx`).
 *   - `<StepCard>` (same API, visual retune in `step-card.tsx`).
 *   - `<IngredientChecklist>` (legacy fallback for meals predating
 *     R18's Refine save).
 *   - Export helpers (`formatStructuredIngredientForExport` /
 *     WhatsApp / Copy buttons) ship inside StructuredIngredientList.
 *
 * Removed from R25:
 *   - `<PageTitle>` — replaced by the split-title pair (italic kicker
 *     + display headline) derived via `splitMealName(name)`.
 *   - Page-level action row (Refine / Log again / Share) — relocated
 *     to the TopBar via `useSetTopBarActions`.
 *   - The "Refresh ingredients" affordance (the
 *     `IngredientChecklist`'s `canExtract` button still exists in
 *     legacy fallback, but the user-facing rename / promotion is
 *     deferred).
 *
 * Deferred to a follow-up:
 *   - Cook mode route. The "Cook mode" link in the recipe column
 *     header is decorative (no handler) until real signal says the
 *     cook-from-screen view is a separate surface.
 *   - Dynamic breadcrumb resolution — `/meal/[id]` still reads
 *     "Recipe" in the TopBar trail.
 */

const EFFORT_BADGE_VARIANT: Record<
  "quick" | "easy" | "medium" | "high_effort",
  "sage" | "wheat" | "terra"
> = {
  quick: "sage",
  easy: "sage",
  medium: "wheat",
  high_effort: "terra"
};

const EFFORT_LABEL: Record<
  "quick" | "easy" | "medium" | "high_effort",
  string
> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High effort"
};

function lastCookedLabel(lastCookedAt: string | null): string | null {
  if (!lastCookedAt) return null;
  const days = differenceInCalendarDays(new Date(), parseISO(lastCookedAt));
  if (days <= 0) return "cooked today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return format(parseISO(lastCookedAt), "MMM yyyy");
}

/**
 * Sum the per-step `time` strings into a single rolled-up label
 * ("~45 min", "~1 hr 30 min"). Mirrors the mobile pattern at
 * `apps/mobile/app/(authed)/meal/[id]/index.tsx:311` so both clients
 * surface the same total when the AI populates time eyebrows.
 *
 * Returns `null` when no step has a parseable duration — caller skips
 * the chip rather than rendering "0 min".
 */
function totalStepTimeLabel(
  steps: ReadonlyArray<{ time: string | null }>
): string | null {
  let totalMinutes = 0;
  let anyParsed = false;
  for (const step of steps) {
    if (!step.time) continue;
    const matches = step.time.matchAll(
      /(\d+(?:\.\d+)?)\s*(min|minute|minutes|hr|hour|hours)/gi
    );
    for (const m of matches) {
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      const unit = m[2].toLowerCase();
      totalMinutes += unit.startsWith("h") ? n * 60 : n;
      anyParsed = true;
    }
  }
  if (!anyParsed || totalMinutes <= 0) return null;
  if (totalMinutes < 60) {
    return `~${Math.round(totalMinutes / 5) * 5 || totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes - hours * 60;
  return rem === 0 ? `~${hours} hr` : `~${hours} hr ${rem} min`;
}

export type RecipeDetailMeal = {
  id: string;
  name: string;
  photoUrl: string | null;
  recipeText: string | null;
  recipeSourceUrl: string | null;
  servings: string | null;
  ingredients: string[] | null;
  /** Recipe was AI-generated from a name; show a "review this" banner. */
  recipeIsAiDraft: boolean;
  /** Viewer's effective permissions (owner / admin / editor / viewer). */
  viewerCanEdit: boolean;
  viewerCanManageSharing: boolean;
  /**
   * Viewer is the recipe's creator. Gates the owner-only lifecycle actions
   * (Archive / Delete), which the service enforces strictly on the creator —
   * distinct from `viewerCanEdit` / `viewerCanManageSharing`, which also
   * cover edit/admin grantees who'd hit a NOT_FOUND on these.
   */
  viewerIsCreator: boolean;
  createdByUserId: string | null;
  createdByName: string | null;
  cookCount: number;
  lastCookedAt: string | null;
  effortLevel: "quick" | "easy" | "medium" | "high_effort" | null;
  structuredIngredients: Array<{
    id: string;
    position: number;
    name: string;
    quantityString: string;
    prepNote: string | null;
  }>;
  structuredSteps: Array<{
    id: string;
    position: number;
    title: string;
    time: string | null;
    body: string;
    ingredientIds: string[];
  }>;
  /**
   * Alternate recipes for the same dish (e.g. brought in when a member
   * joined the kitchen with their own copy). Empty for most meals; when
   * present the view renders a switcher between the base recipe and each
   * variant.
   */
  variants: RecipeVariantView[];
  /**
   * Other VISIBLE recipes for the same dish name — the viewer's own copy
   * and/or copies shared with them. Rendered as switch pills that link to
   * each recipe's own page.
   */
  sameDishRecipes: Array<{
    mealId: string;
    ownerName: string;
    viewerIsOwner: boolean;
  }>;
};

export type RecipeVariantView = {
  id: string;
  label: string;
  recipeText: string | null;
  ingredients: string[] | null;
  recipeSourceUrl: string | null;
  servings: string | null;
  photoUrl: string | null;
  notes: string | null;
  structuredIngredients: Array<{
    id: string;
    position: number;
    name: string;
    quantityString: string;
    prepNote: string | null;
  }>;
  structuredSteps: Array<{
    id: string;
    position: number;
    title: string;
    time: string | null;
    body: string;
    ingredientIds: string[];
  }>;
};

/**
 * Round 32 — viewing context the share/personal affordance and
 * visibility chip need. `currentUserId` is the active session's user;
 * `householdMemberCount` controls whether the affordance + chip
 * render at all (single-member households hide both).
 */
export type RecipeDetailViewer = {
  currentUserId: string;
  householdMemberCount: number;
};

/**
 * Hero image with read-after-write resilience. A just-generated R2 object
 * can briefly miss on its very first public GET (edge lag on the r2.dev
 * domain), which would otherwise leave a broken image stuck until a manual
 * refresh. On load error we retry the same URL with a cache-busting param a
 * few times (short backoff); if it still won't load, we fall back to the
 * monogram tile. State resets naturally because the parent keys this
 * component on `src`.
 */
function DishHeroImage({ src, name }: { src: string; name: string }) {
  const MAX_IMG_RETRIES = 4;
  const [retry, setRetry] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  function handleError() {
    if (retry >= MAX_IMG_RETRIES) {
      setFailed(true);
      return;
    }
    // Back off (~0.6s, 1.2s, 1.8s, 2.4s) so the edge has time to catch up
    // rather than burning every retry in the same millisecond.
    const next = retry + 1;
    window.setTimeout(() => setRetry(next), 600 * next);
  }

  if (failed) {
    return (
      <MealTile name={name} size="l" className="h-full w-full rounded-none border-0" />
    );
  }

  // Append the retry counter so the browser refetches instead of reusing a
  // cached miss. r2.dev ignores the extra query param.
  const displaySrc =
    retry > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${retry}` : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={name}
      className="h-full w-full object-cover"
      onError={handleError}
    />
  );
}

export function RecipeDetailClient({
  meal
}: {
  meal: RecipeDetailMeal;
  // `viewer` is still accepted for call-site compatibility but no longer
  // read — write affordances are gated by the server-sent permission flags
  // on `meal` (viewerCanEdit / viewerCanManageSharing).
  viewer?: RecipeDetailViewer;
}) {
  // Recipe variants — alternate recipes for the same dish (e.g. brought in
  // when a member joined the kitchen with their own copy). `null` selects
  // the base recipe; a variant id swaps the recipe-bearing content below
  // while the dish identity (name, logs, sharing) stays put.
  const variants = meal.variants ?? [];
  const sameDishRecipes = meal.sameDishRecipes ?? [];
  const [activeVariantId, setActiveVariantId] = React.useState<string | null>(
    null
  );
  const activeVariant =
    variants.find((v) => v.id === activeVariantId) ?? null;

  // Structured-prefer with legacy fallback — mirrors mobile (R19) +
  // R21's web parity. Empty structured arrays mean the meal predates
  // the R18 Refine save path; fall through to the R10 text[] +
  // R7 recipeText blob.
  //
  // Wrap the array reads in `useMemo` so the `??` fallback identity
  // is stable for downstream memos. Without it, each render creates a
  // fresh `[]` and the dependent useMemos re-run unnecessarily.
  const structuredIngredients = React.useMemo(
    () => (activeVariant?.structuredIngredients ?? meal.structuredIngredients) ?? [],
    [activeVariant, meal.structuredIngredients]
  );
  const structuredSteps = React.useMemo(
    () => (activeVariant?.structuredSteps ?? meal.structuredSteps) ?? [],
    [activeVariant, meal.structuredSteps]
  );
  // Legacy-shaped fields follow the active recipe too.
  const activeRecipeText = activeVariant
    ? activeVariant.recipeText
    : meal.recipeText;
  const activeLegacyIngredients = activeVariant
    ? activeVariant.ingredients
    : meal.ingredients;
  const activeServings = activeVariant ? activeVariant.servings : meal.servings;
  const activeSourceUrl = activeVariant
    ? activeVariant.recipeSourceUrl
    : meal.recipeSourceUrl;
  const hasStructuredIngredients = structuredIngredients.length > 0;

  const sortedStructuredIngredients = React.useMemo(
    () =>
      hasStructuredIngredients
        ? structuredIngredients.slice().sort((a, b) => a.position - b.position)
        : [],
    [structuredIngredients, hasStructuredIngredients]
  );

  const stepCards: StepCardData[] = React.useMemo(() => {
    if (structuredSteps.length === 0) return [];
    const nameById = new Map<string, string>(
      structuredIngredients.map((row) => [row.id, row.name])
    );
    return structuredSteps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row, idx) => ({
        number: idx + 1,
        title: row.title,
        time: row.time,
        body: row.body,
        ingredients: row.ingredientIds
          .map((iid) => nameById.get(iid))
          .filter((name): name is string => Boolean(name))
      }));
  }, [structuredSteps, structuredIngredients]);

  const totalTime = totalStepTimeLabel(structuredSteps);
  const ingredientCount = hasStructuredIngredients
    ? sortedStructuredIngredients.length
    : activeLegacyIngredients?.length ?? 0;
  const stepCount = stepCards.length;

  // R28 — retroactive dynamic breadcrumb. The TopBar's static map
  // resolves `/meal/[id]` to "Recipe"; this hook replaces that last
  // crumb with the actual meal name. Cleanup runs on unmount so
  // back-navigation falls through to the static label.
  useSetBreadcrumb(meal.name);

  // Editorial title pair. Single-word names render headline-only;
  // multi-word names get the italic kicker + roman headline split
  // (e.g. "Chowmein," / "Noodles.").
  const titleParts = React.useMemo(
    () => splitMealName(meal.name),
    [meal.name]
  );

  // Meta line — degrades gracefully when fields aren't available.
  // "Added by {name} · {N} cook(s) · {timeAgo}" is the design's
  // target shape; we omit segments that don't have data rather than
  // rendering "0 cooks" or "Last cooked never".
  const metaLine = React.useMemo(() => {
    const addedBy = meal.createdByUserId
      ? meal.createdByName ?? "Former member"
      : "Former member";
    const segments: string[] = [];
    segments.push(`Added by ${addedBy}`);
    if (meal.cookCount > 0) {
      segments.push(
        meal.cookCount === 1 ? "1 cook" : `${meal.cookCount} cooks`
      );
    }
    const last = lastCookedLabel(meal.lastCookedAt);
    if (last && meal.cookCount > 0) {
      segments.push(last);
    }
    return segments.join(" · ");
  }, [
    meal.createdByUserId,
    meal.createdByName,
    meal.cookCount,
    meal.lastCookedAt
  ]);

  // Per-item permissions (server-authoritative). `canEdit` gates write
  // affordances (Refine, photo) for the owner + edit/admin grantees;
  // `canManageSharing` gates the Share sheet's role controls (owner/admin).
  const canEdit = meal.viewerCanEdit;
  const canManageSharing = meal.viewerCanManageSharing;

  // Owner-only lifecycle (Archive / Delete). Archive fires directly (it's
  // reversible, with an Undo toast); Delete routes through a confirm dialog.
  const lifecycle = useRecipeLifecycle(meal.id, meal.name);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Dish image. `meal.photoUrl` arrives already coalesced server-side
  // (the meal's own photo → the app-wide AI image), so a non-null value
  // means there's something to show. When it's null no image exists for
  // this dish yet, and the recipe view triggers a one-time, app-wide
  // generation. Local state lets the tile swap in place once the
  // generated image (or a device upload) resolves.
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(meal.photoUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dish-image generation is now on-demand + metered (10 credits) via
  // `GenerateImageButton` in the hero actions — no longer auto-fired on mount.
  const setMealPhoto = trpc.meals.setPhoto.useMutation();
  const isUploadingPhoto = setMealPhoto.isPending;

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file still fires onChange.
    event.target.value = "";
    if (!file) return;
    try {
      const url = await uploadPhoto(file);
      const result = await setMealPhoto.mutateAsync({ mealId: meal.id, photoUrl: url });
      setPhotoUrl(result.photoUrl);
      showToast({ variant: "success", title: "Photo updated" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't update the photo",
        description: error instanceof Error ? error.message : "Try again."
      });
    }
  }

  return (
    // Outer wrapper bleeds out the layout's `<main>` padding
    // (`px-8 py-7` at md+, `px-4 py-5` below). Negative margins +
    // matching pb so the new bands fill edge-to-edge while the
    // layout-level bottom-tab clearance (`pb-20` / `pb-28`) still
    // applies via the layout itself. We don't neutralize the bottom
    // padding — its purpose is letting content clear the bottom
    // tab bar on mobile, which is still relevant.
    <div className="-mx-4 -my-5 sm:-mx-8 sm:-my-7">
      {/* Hero band — square hashed-palette tile + split title + chips. */}
      <section className="grid gap-0 border-b border-[var(--border)] md:grid-cols-[360px_1fr]">
        <div className="relative aspect-square w-full max-md:max-h-[360px] md:max-h-[360px]">
          {photoUrl ? (
            // `key={photoUrl}` remounts (resetting retry/fail state) when a
            // new generation result or device upload swaps the source in.
            <DishHeroImage key={photoUrl} src={photoUrl} name={meal.name} />
          ) : (
            <MealTile
              name={meal.name}
              size="l"
              className="h-full w-full rounded-none border-0"
            />
          )}
          {/* While the app-wide image generates (or a device photo
              uploads), keep the monogram/old photo visible under a
              subtle spinner overlay rather than flashing a blank box. */}
          {!photoUrl && isUploadingPhoto ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Loader2 className="h-5 w-5 animate-spin text-white drop-shadow" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 px-7 pb-7 pt-7 sm:px-9 sm:pt-9 md:gap-4 md:pt-9">
          <p
            className="font-mono text-[11px] uppercase text-[var(--subtle-fg,var(--muted-foreground))]"
            style={{ letterSpacing: "0.15em" }}
          >
            Recipe · in library
          </p>
          {titleParts.kicker ? (
            <p
              className="font-serif text-[24px] italic leading-none text-muted-foreground sm:text-[26px]"
              style={{ letterSpacing: "-0.005em" }}
            >
              {titleParts.kicker}
            </p>
          ) : null}
          <h1
            className="font-serif text-[60px] leading-[0.92] text-foreground sm:text-[72px] lg:text-[88px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {titleParts.headline}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {meal.effortLevel ? (
              <Badge variant={EFFORT_BADGE_VARIANT[meal.effortLevel]}>
                {EFFORT_LABEL[meal.effortLevel]}
              </Badge>
            ) : null}
            {activeServings?.trim() ? (
              <Badge variant="ghost">{activeServings.trim()}</Badge>
            ) : null}
            {ingredientCount > 0 ? (
              <Badge variant="ghost">
                {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {stepCount > 0 ? (
              <Badge variant="wheat">
                {stepCount} step{stepCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {totalTime ? (
              <Badge variant="ghost" className="font-mono">
                {totalTime}
              </Badge>
            ) : null}
            {/* Sharing state now lives in the "Who can see this" strip
                below the hero (per-item sharing model). */}
          </div>
          <p
            className="mt-1 font-mono text-[11px] uppercase text-[var(--subtle-fg,var(--muted-foreground))]"
            style={{ letterSpacing: "0.13em" }}
          >
            {metaLine}
          </p>
          {/* Primary actions live in the hero (not the top bar). Order
              per the handoff: "Log a cook" (primary forest) leads, then
              "Refine with AI" (ghost); contextual Share + photo follow. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <LogAgainButton
              mealName={meal.name}
              effortLevel={meal.effortLevel ?? "easy"}
              variant="default"
              size="default"
              icon="check"
              label="Log a cook"
              compact
              className="min-h-[40px]"
            />
            {/* One editor surface (R34): edit by hand or ask AI to change it,
                in the same screen. WRITE surface — owner + edit/admin grantees
                only; non-editors are hidden to avoid a FORBIDDEN. */}
            {canEdit ? (
              <Button asChild variant="outline" className="min-h-[40px]">
                <Link href={`/meal/${meal.id}/edit` as Route}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit recipe
                </Link>
              </Button>
            ) : null}
            {/* Device photo upload — editors (owner/admin/edit) only. Reuses
                the presign → R2 flow; the photo becomes the meal's own image
                and wins over the app-wide AI fallback. */}
            {canEdit ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[40px]"
                  disabled={isUploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {photoUrl ? "Change photo" : "Add photo"}
                </Button>
              </>
            ) : null}
            {/* On-demand AI dish image (10 credits) — only when this dish has
                no image at all. A user photo or app-wide cached image wins and
                hides this. */}
            {canEdit && !photoUrl ? (
              <GenerateImageButton
                mealId={meal.id}
                onGenerated={(url) => setPhotoUrl(url)}
              />
            ) : null}
            {/* Owner-only lifecycle, tucked behind a ⋯ menu so the destructive
                actions don't sit inline with the everyday ones. Gated on
                `viewerIsCreator` — edit/admin grantees would hit a NOT_FOUND. */}
            {meal.viewerIsCreator ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[40px] px-3"
                    aria-label="More recipe actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => lifecycle.archive()}>
                    <Archive className="h-4 w-4" />
                    Archive recipe
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setConfirmDelete(true)}
                    className="text-[color:var(--terra,var(--destructive))] focus:text-[color:var(--terra,var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete recipe
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </section>

      {/* Delete confirmation (destructive, owner-only). Mirrors the library's
          copy + treatment; success leaves for /library with an Undo toast. */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--terra-soft,#f3e0d7)] text-[color:var(--terra,var(--destructive))]">
                <Trash2 className="h-4 w-4" />
              </span>
              Delete &ldquo;{meal.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {meal.cookCount > 0
                ? `This removes the recipe and its ${meal.cookCount} logged cook${meal.cookCount === 1 ? "" : "s"}. You can undo right after.`
                : "This removes the recipe from your library. You can undo right after."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[color:var(--terra,var(--destructive))] text-white hover:opacity-90"
              onClick={() => {
                setConfirmDelete(false);
                lifecycle.remove();
              }}
            >
              Delete recipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* "Who can see this" strip — per-item sharing entry point. */}
      <WhoCanSeeStrip
        itemType="recipe"
        itemId={meal.id}
        itemName={meal.name}
        isOwner={canManageSharing}
        ownerName={meal.createdByName}
      />

      {/* Recipe switcher — shown when the viewer can see OTHER recipes for
          this same dish (their own copy and/or copies shared with them; each
          pill navigates to that recipe's page), and/or when this meal carries
          in-place variants. Other members' private same-named copies never
          appear here. */}
      {variants.length > 0 || sameDishRecipes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
          <span
            className="font-mono text-[11px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.13em" }}
          >
            Recipes
          </span>
          <Button
            type="button"
            size="sm"
            variant={activeVariant ? "outline" : "default"}
            aria-pressed={!activeVariant}
            onClick={() => setActiveVariantId(null)}
          >
            {meal.viewerIsCreator
              ? "My recipe"
              : meal.createdByName
                ? `${meal.createdByName.trim().split(/\s+/)[0]}'s recipe`
                : "This recipe"}
          </Button>
          {variants.map((v) => (
            <Button
              key={v.id}
              type="button"
              size="sm"
              variant={activeVariantId === v.id ? "default" : "outline"}
              aria-pressed={activeVariantId === v.id}
              onClick={() => setActiveVariantId(v.id)}
            >
              {v.label}
            </Button>
          ))}
          {sameDishRecipes.map((r) => (
            <Button key={r.mealId} asChild size="sm" variant="outline">
              <Link href={`/meal/${r.mealId}` as Route}>{r.ownerName}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      {/* AI-generated draft notice — this recipe was inferred from the dish
          name, not the user's source, so nudge a review. Cleared once the
          recipe is hand-edited or refined. The flag describes the BASE
          recipe, so it hides while a variant is selected. */}
      {meal.recipeIsAiDraft && !activeVariant ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--warning,#b7791f)]/30 bg-[color:var(--warning,#b7791f)]/10 px-5 py-3 text-[13px] text-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--warning,#b7791f)]" />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">AI-generated draft.</strong> This recipe was
            generated from the dish name. Review the ingredients and steps, quantities are a
            starting point.
          </span>
          {canEdit ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/meal/${meal.id}/edit` as Route}>
                <Pencil className="h-3.5 w-3.5" />
                Review &amp; edit
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Body band — cream-soft ingredients sidebar + recipe column. */}
      <section className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
        {/* Sidebar */}
        <aside className="border-b border-[var(--border)] bg-[var(--surface-2)] px-7 py-7 sm:px-9 md:border-b-0 md:border-r md:py-9">
          <SectionLabel
            className="mb-3"
            action={
              ingredientCount > 0 ? (
                <span
                  className="font-mono text-[11px] uppercase text-muted-foreground"
                  style={{ letterSpacing: "0.13em" }}
                >
                  {ingredientCount} {ingredientCount === 1 ? "item" : "items"}
                </span>
              ) : null
            }
          >
            Ingredients
          </SectionLabel>
          {hasStructuredIngredients ? (
            <StructuredIngredientList
              ingredients={sortedStructuredIngredients}
              mealName={meal.name}
            />
          ) : (
            <IngredientChecklist
              ingredients={activeLegacyIngredients}
              mealName={meal.name}
              mealId={meal.id}
              // Extraction writes the BASE recipe's structured rows —
              // disabled while a variant is selected.
              canExtract={!activeVariant && Boolean(meal.recipeText?.trim())}
            />
          )}
        </aside>

        {/* Recipe column */}
        <div className="px-7 py-7 sm:px-9 sm:py-10 md:pr-12">
          {/* "Cook mode" affordance removed — it was a disabled no-op
              (the full-screen cook view was never built). Tracked in
              GH issue #58 to build for real. */}
          <SectionLabel className="mb-4">Recipe</SectionLabel>
          {stepCards.length > 0 ? (
            <ol className="grid list-none divide-y divide-[var(--border-soft,var(--border))]">
              {stepCards.map((step) => (
                <li key={step.number}>
                  <StepCard step={step} />
                </li>
              ))}
            </ol>
          ) : activeRecipeText ? (
            // pre-wrap preserves the AI-extracted line breaks; font-sans
            // overrides the <pre> default so the recipe reads as prose,
            // not code. Comfortable reading line-height.
            <pre
              className={cn(
                "max-w-[620px] whitespace-pre-wrap font-sans text-[15px] leading-[1.6] text-foreground"
              )}
            >
              {activeRecipeText}
            </pre>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No recipe saved for this meal yet.
            </p>
          )}
          {activeSourceUrl ? (
            <div className="mt-8 grid gap-2">
              <SectionLabel>Source</SectionLabel>
              <SourceUrlEmbed
                url={activeSourceUrl}
                mealName={meal.name}
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href={activeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  View original →
                </a>
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
