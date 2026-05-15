import "server-only";

import { z } from "zod";
import { listMealLibrary } from "@/services/plans";
import { householdMemberProcedure, router } from "../trpc";

/**
 * Round 11 — unified search. Today the only searchable surface is
 * the household's saved meal library (the `listMealLibrary` service
 * already supports a substring `q` filter). When a richer search
 * lands (cross-household recipes, full-text on `recipeText`, etc.),
 * extend this router rather than spawning a new one — the client
 * surface stays `trpc.search.meals(...)` and downstream changes are
 * compatible.
 */
export const searchRouter = router({
  meals: householdMemberProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(200),
        limit: z.number().int().min(1).max(50).optional()
      })
    )
    .query(({ ctx, input }) =>
      listMealLibrary({
        userId: ctx.user.id,
        householdId: ctx.household.id,
        q: input.q,
        limit: input.limit
      })
    )
});
