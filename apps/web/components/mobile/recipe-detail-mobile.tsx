"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Camera, ChevronLeft, ExternalLink, Loader2, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { uploadPhoto } from "@/lib/uploads/upload-photo";
import { MealImage } from "@/components/mobile/meal-image";
import { splitMealName } from "@/lib/meal/split-name";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { GenerateImageButton } from "@/components/credits/generate-image-button";
import { MobileScaffold } from "@/components/mobile/mobile-scaffold";
import { ShareSheet } from "@/components/sharing/share-sheet";
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
import { useToast } from "@/components/providers/toast-provider";
import { useRecipeLifecycle } from "@/components/meals/use-recipe-lifecycle";
import type { RecipeDetailMeal, RecipeDetailViewer } from "@/components/meals/recipe-detail-client";

const EFFORT_LABEL: Record<"quick" | "easy" | "medium" | "high_effort", string> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High effort"
};

/** Format a structured ingredient row into a single display line. */
function formatIngredient(row: { name: string; quantityString: string; prepNote: string | null }): string {
  const name = row.name.trim() || "ingredient";
  const qty = row.quantityString.trim();
  const base = qty ? `${qty} ${name}` : name;
  return row.prepNote?.trim() ? `${base}, ${row.prepNote.trim()}` : base;
}

/**
 * Copy text to the clipboard. Prefers the async Clipboard API (secure
 * contexts), and falls back to a hidden-textarea `execCommand("copy")` for
 * non-secure dev contexts (e.g. http://localtest.me:3003) where
 * `navigator.clipboard` is undefined. Returns whether the copy succeeded.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * R35 mobile-web Recipe detail. Renders below `md`; the desktop
 * `<RecipeDetailClient>` renders `hidden md:block` alongside, both off the same
 * server `meal` payload. Prefers structured ingredients/steps, falls back to
 * the legacy `ingredients` array + `recipeText` blob (legacy meals predate
 * Refine). The Cooking view is deferred (R35), so "Start cooking" scrolls to
 * the method section.
 */
export function RecipeDetailMobile({ meal }: { meal: RecipeDetailMeal; viewer: RecipeDetailViewer }) {
  const router = useRouter();
  const { showToast } = useToast();
  const titleParts = splitMealName(meal.name);
  const [shareOpen, setShareOpen] = React.useState(false);

  // Owner-only lifecycle (Archive / Delete), reached from the ⋯ menu in the
  // hero bar. Same hook + UX as the desktop view.
  const lifecycle = useRecipeLifecycle(meal.id, meal.name);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Photo: editors can replace the hero image (device upload) or, when the dish
  // has none yet, generate an AI one. Mirrors the desktop hero actions. Local
  // `photoUrl` state swaps the hero in place once an upload/generation resolves.
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(meal.photoUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
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

  const ingredientLines = React.useMemo(() => {
    if (meal.structuredIngredients.length > 0) {
      return [...meal.structuredIngredients]
        .sort((a, b) => a.position - b.position)
        .map((r) => formatIngredient(r));
    }
    return (meal.ingredients ?? []).map((s) => s.trim()).filter(Boolean);
  }, [meal.structuredIngredients, meal.ingredients]);

  const steps = React.useMemo(() => {
    if (meal.structuredSteps.length > 0) {
      return [...meal.structuredSteps]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ title: s.title, time: s.time, body: s.body }));
    }
    // Legacy fallback: split the recipe-text blob into paragraph "steps".
    const text = meal.recipeText?.trim() ?? "";
    if (!text) return [];
    return text
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean)
      .map((body) => ({ title: "", time: null as string | null, body }));
  }, [meal.structuredSteps, meal.recipeText]);

  // Ingredient checklist: checked = "have it"; remaining = "to buy".
  const [checked, setChecked] = React.useState<Set<number>>(() => new Set());
  const toBuy = ingredientLines.length - checked.size;
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const shareList = React.useCallback(async () => {
    const remaining = ingredientLines.filter((_, i) => !checked.has(i));
    if (remaining.length === 0) {
      showToast({ title: "All checked off", description: "Nothing left to buy.", variant: "info" });
      return;
    }
    const text = `Shopping list for ${meal.name}:\n${remaining.map((l) => `- ${l}`).join("\n")}`;

    // Native share sheet first (mobile, secure context).
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${meal.name} shopping list`, text });
        return;
      } catch (err) {
        // User dismissed the sheet: treat as a no-op. Any other failure falls
        // through to the clipboard path below.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    const copied = await copyToClipboard(text);
    showToast(
      copied
        ? {
            title: "Shopping list copied",
            description: `${remaining.length} item${remaining.length === 1 ? "" : "s"} to buy.`,
            variant: "success"
          }
        : { title: "Couldn't share the list", description: "Try again from your browser menu.", variant: "error" }
    );
  }, [ingredientLines, checked, meal.name, showToast]);

  const metaPills: string[] = [];
  if (meal.servings) metaPills.push(meal.servings);
  if (meal.cookCount > 0) metaPills.push(`${meal.cookCount} cook${meal.cookCount === 1 ? "" : "s"}`);

  return (
    <MobileScaffold>
      {/* Transparent hero bar (back + share), overlaying the palette hero. */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),10px)]">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-card/85 text-foreground backdrop-blur"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {meal.viewerCanManageSharing ? (
              <button
                type="button"
                aria-label="Share recipe"
                onClick={() => setShareOpen(true)}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-card/85 text-foreground backdrop-blur"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
            ) : null}
            {meal.viewerIsCreator ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More recipe actions"
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-card/85 text-foreground backdrop-blur"
                  >
                    <MoreVertical className="h-[18px] w-[18px]" />
                  </button>
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
        <MealImage name={meal.name} photoUrl={photoUrl} size="l" className="h-[180px] w-full rounded-none" />
        {meal.viewerCanEdit ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoSelected}
            />
            <button
              type="button"
              aria-label={photoUrl ? "Change photo" : "Add photo"}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute bottom-3 right-3 z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-card/85 text-foreground backdrop-blur disabled:opacity-60"
            >
              {isUploadingPhoto ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <Camera className="h-[18px] w-[18px]" />
              )}
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
          {meal.effortLevel ? EFFORT_LABEL[meal.effortLevel] : "Recipe"}
        </div>
        <h1 className="mt-1.5 font-serif text-[34px] leading-[1.04] tracking-[-0.02em] text-foreground">
          {titleParts.kicker && <span className="italic text-primary">{titleParts.kicker} </span>}
          {titleParts.headline}
        </h1>
        {metaPills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {metaPills.map((p) => (
              <span
                key={p}
                className="rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-secondary-foreground"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <a
            href="#method"
            className="flex h-11 items-center justify-center rounded-[12px] bg-primary text-[14px] font-semibold text-primary-foreground active:scale-[0.99]"
          >
            Start cooking
          </a>
          {meal.viewerCanEdit ? (
            <Link
              href={`/meal/${meal.id}/edit`}
              className="flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-border bg-card text-[14px] font-semibold text-foreground active:scale-[0.99]"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          ) : (
            <LogAgainButton
              mealName={meal.name}
              effortLevel={meal.effortLevel}
              icon="check"
              label="I cooked this"
              variant="outline"
              size="default"
              className="h-11 w-full rounded-[12px]"
            />
          )}
        </div>
        {meal.viewerCanEdit && (
          <div className="mt-2.5">
            <LogAgainButton
              mealName={meal.name}
              effortLevel={meal.effortLevel}
              icon="check"
              label="I cooked this"
              variant="secondary"
              size="default"
              className="h-11 w-full rounded-[12px]"
            />
          </div>
        )}

        {/* No image yet: offer AI generation (10 credits). A device upload via
            the hero camera button wins over this and hides it. */}
        {meal.viewerCanEdit && !photoUrl ? (
          <div className="mt-2.5">
            <GenerateImageButton
              mealId={meal.id}
              onGenerated={(url) => setPhotoUrl(url)}
              className="h-11 w-full rounded-[12px]"
            />
          </div>
        ) : null}

        {meal.recipeSourceUrl && (
          <a
            href={meal.recipeSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View original source
          </a>
        )}
      </div>

      {/* Ingredients */}
      {ingredientLines.length > 0 && (
        <section className="mt-6 px-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
              Ingredients · {ingredientLines.length}
            </h2>
            <button
              type="button"
              onClick={() => void shareList()}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-primary"
            >
              Share list
            </button>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--ink3)]">
            {toBuy === 0 ? "All set" : `${toBuy} to buy`}
          </p>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
            {ingredientLines.map((line, i) => {
              const isChecked = checked.has(i);
              return (
                <li key={`${line}-${i}`}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-[color:var(--surface-2)]"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                        isChecked ? "border-primary bg-primary text-primary-foreground" : "border-[color:var(--ink4)]"
                      )}
                    >
                      {isChecked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[14.5px] leading-snug",
                        isChecked ? "text-[color:var(--ink3)] line-through" : "text-foreground"
                      )}
                    >
                      {line}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Method */}
      {steps.length > 0 && (
        <section id="method" className="mt-7 px-4 pb-4 scroll-mt-16">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">Method</h2>
          <ol className="mt-3 space-y-5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="shrink-0 font-serif text-[26px] italic leading-none text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1 pt-0.5">
                  {step.title && (
                    <h3 className="font-serif text-[18px] leading-tight tracking-[-0.01em] text-foreground">
                      {step.title}
                    </h3>
                  )}
                  {step.time && (
                    <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                      {step.time}
                    </div>
                  )}
                  <p className={cn("text-[14.5px] leading-relaxed text-foreground", step.title && "mt-1.5")}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {ingredientLines.length === 0 && steps.length === 0 && (
        <div className="px-4 py-10 text-center text-[14px] text-muted-foreground">
          No recipe details saved yet.{" "}
          {meal.viewerCanEdit && (
            <Link href={`/meal/${meal.id}/edit`} className="font-medium text-primary">
              Add them
            </Link>
          )}
        </div>
      )}

      {meal.viewerCanManageSharing ? (
        <ShareSheet
          itemType="recipe"
          itemId={meal.id}
          itemName={meal.name}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}

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
    </MobileScaffold>
  );
}
