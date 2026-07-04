# Isolation read audit (June 2026)

Audit of database **read** queries in `apps/web/services/` for missing
row-isolation filters. The app has no Postgres RLS today: every query runs as a
single privileged role and isolation is enforced entirely by application-layer
`WHERE` clauses. This report is the companion to the full RLS retrofit (see the
plan); each genuine finding notes which RLS policy will close it structurally,
so we are **not** hand-patching the queries.

## Method

Every `db.select` / `db.query.*` read in the service layer was traced to its
**call path**, not judged in isolation. The key rule:

> A read keyed only by a foreign key (e.g. `meal_ingredients` by `mealId`) is
> safe **if** the parent row was already authorized earlier in the same
> function.

Most reads that "look" unscoped are this pattern and are **not** bugs. They are
listed below as false positives so a future audit does not re-flag them.

## Severity legend

- **HIGH** — unauthenticated or cross-tenant exposure of another user's data.
- **MED** — cross-member exposure within a household, behind auth + a feature
  gate, of personal payload (cook notes) or a private per-creator recipe.
- **LOW** — divergence from the documented privacy rule with negligible payload
  (effort enum only); consistency issue.

No HIGH findings. The application-layer enforcement is broadly correct; the
genuine findings are narrow, all behind household membership + feature gates.

## Genuine findings

| # | Location | Sev | Problem | Closed by RLS policy |
|---|----------|-----|---------|----------------------|
| 1 | `services/ai.ts:106-124` `generateShareableRecipe` | MED | `latestLog` reads the latest meal log scoped by `householdId` only (no `cookedByUserId`) and passes `latestLog?.notes` into AI share-text generation. Another member's **private cook notes** can surface in the share text a different member generates. Violates R32 ("sharing never exposes another member's log notes"). | `mealLogs` personal policy (`cooked_by_user_id = app_current_user()`) under the restricted role → the read returns only the viewer's own latest log. **Must stay on restricted `db`, not the privileged path.** |
| 2 | `services/ai.ts:84-96` `generateShareableRecipe` | MED | Meal read scopes by `householdId` but omits `mealVisibilityFilter`. A member can generate share text (incl. `recipeText`) for a **co-member's private per-creator meal** they cannot otherwise open in `getMealDetail`. Inconsistent with the R32 visibility model. | `meals` policy (`household_id IN app_user_households() AND (created_by = me OR active grant)`) → a co-member's private meal returns 0 rows; the function returns its existing "Meal not found." |
| 3 | `services/refine.ts:97-110` `loadRecipeContext` | LOW | Effort aggregation scopes by `householdId` only; the inline comment claims parity with `getMealDetail`, but that function filters `cookedByUserId` ([meals.ts:939](../../apps/web/services/meals.ts)). Runs **after** `requireItemEditor` (user is authorized), so this is a privacy-nuance/consistency divergence, not an access leak. Effort enum only, no notes/photos. | `mealLogs` personal policy → aggregation becomes per-viewer, matching `getMealDetail`. **Keep on restricted `db`** (do not add to the privileged carve-out). |

## Documentation correction (feeds CLAUDE.md update)

CLAUDE.md lists "the AI-context latest-log read in `services/ai.ts`" as an
exception that is "effort enum only, no personal payload." That is **inaccurate**:
the only `mealLogs` read in `ai.ts` is finding #1, which reads `notes` (personal
payload), not effort. The genuinely effort-only exception is
[`plans.ts:739-744`](../../apps/web/services/plans.ts) (the plan-dish effort
modal: reads `effortLevel`, household-wide by design). The CLAUDE.md exception
note should be corrected to point at `plans.ts` only, and finding #1 treated as
RLS-closed rather than an intended exception.

## Verified safe (false positives — no change)

| Location | Why it is safe |
|----------|----------------|
| `getMealDetail` ingredient/step/variant reads ([meals.ts:950-1020](../../apps/web/services/meals.ts)) | `requireHouseholdMember` + `mealVisibilityFilter` run first; `if (!row) return null` before any FK read ([meals.ts:851-897](../../apps/web/services/meals.ts)). |
| `getMealDetail` cook stats + effort ([meals.ts:912-943](../../apps/web/services/meals.ts)) | Both filter `cookedByUserId = userId` — personal history correctly scoped. |
| `forkRecipe` source meal + ingredient/step reads ([sharing.ts:891-962](../../apps/web/services/sharing.ts)) | Requires an active `itemGrants` row for the forker first; throws "isn't shared with you" otherwise ([sharing.ts:876-888](../../apps/web/services/sharing.ts)). |
| `addDishToPlan` meal read ([plans.ts:398-411](../../apps/web/services/plans.ts)) | `loadPlanOrThrow` + `requireItemEditor`, then cross-household reject on `meal.householdId !== plan.householdId`. |
| `extractIngredientsForMeal` meal read ([ai.ts:164-185](../../apps/web/services/ai.ts)) | Read is followed by an owner/`getGrantRole` + `canEditItem` check; all non-editable cases throw the same `NoRecipeTextError`, leaking nothing. |
| `refine.ts:88-91` `loadRecipeContext` meal read | Every caller authorizes first: `requireItemEditor` ([refine.ts:270](../../apps/web/services/refine.ts), [:722](../../apps/web/services/refine.ts), [:1194](../../apps/web/services/refine.ts)) or `ensureSessionOwnership` for session-scoped callers. |
| Per-user reads (`notifications`, `accounts`, `aiCredits`, `subscriptions`) | All filter `userId`. |

## Documented exception to preserve under RLS

`plans.ts:739-744` (plan-dish effort modal) reads `effortLevel` household-wide
on purpose (effort signal for the plan, no personal payload). Under RLS this
read must go through the **privileged** connection to keep its household-wide
behavior. This is the only legitimate effort-only carve-out.

## Outcome

- 0 HIGH, 2 MED, 1 LOW. All three genuine findings are closed structurally by
  the RLS retrofit (findings #1/#3 by the `mealLogs` policy, #2 by the `meals`
  policy) provided those reads stay on the restricted role.
- One CLAUDE.md inaccuracy to fix (the ai.ts "effort-only" exception note).
- Per user decision, code is left as-is; RLS is the fix.
