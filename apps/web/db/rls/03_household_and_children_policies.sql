-- =============================================================================
-- RLS phase 3 — meals / plans, their FK children, household + share tables
-- =============================================================================
-- The visibility model: a recipe/plan is visible to its CREATOR or to anyone
-- holding an active item_grant — deliberately NOT household-gated, so a recipe
-- shared by a connection in another household still opens (mirrors
-- services/meals.ts:getMealDetail / mealVisibilityFilter). Household membership
-- gates only what you can CREATE.
--
-- FK children (ingredients, steps, variants, plan dishes) get a coarse backstop
-- (= "can see the parent"); the app still enforces edit/admin via
-- requireItemEditor for child writes. Tighten later if needed.
--
-- Prereq: phases 1-2 applied. Run as the table owner. Apply + integration-test
-- before phase 4.
-- =============================================================================

-- Perf: the policies below fan out through these. Create before enabling so the
-- planner has them from the first query.
CREATE INDEX IF NOT EXISTS household_members_user_household_idx
  ON household_members (user_id, household_id);
CREATE INDEX IF NOT EXISTS item_grants_active_grantee_idx
  ON item_grants (item_id, grantee_user_id) WHERE revoked_at IS NULL;

-- meals -----------------------------------------------------------------------
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals FORCE ROW LEVEL SECURITY;

CREATE POLICY meals_select ON meals FOR SELECT USING (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'recipe' AND g.item_id = meals.id
      AND g.grantee_user_id = app_current_user() AND g.revoked_at IS NULL
  )
);

CREATE POLICY meals_insert ON meals FOR INSERT WITH CHECK (
  created_by_user_id = app_current_user()
  AND household_id IN (SELECT app_user_households())
);

-- Owner or an edit/admin grantee may update (refine, photos, ingredients,
-- rename). "Only the owner archives" is finer than RLS can express per-column;
-- the app enforces that. Keep creator immutable.
CREATE POLICY meals_update ON meals FOR UPDATE USING (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'recipe' AND g.item_id = meals.id
      AND g.grantee_user_id = app_current_user()
      AND g.role IN ('edit', 'admin') AND g.revoked_at IS NULL
  )
) WITH CHECK (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'recipe' AND g.item_id = meals.id
      AND g.grantee_user_id = app_current_user()
      AND g.role IN ('edit', 'admin') AND g.revoked_at IS NULL
  )
);

CREATE POLICY meals_delete ON meals FOR DELETE USING (
  created_by_user_id = app_current_user()
);

-- plans (mirror of meals, item_type = 'plan') ---------------------------------
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;

CREATE POLICY plans_select ON plans FOR SELECT USING (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'plan' AND g.item_id = plans.id
      AND g.grantee_user_id = app_current_user() AND g.revoked_at IS NULL
  )
);

CREATE POLICY plans_insert ON plans FOR INSERT WITH CHECK (
  created_by_user_id = app_current_user()
  AND household_id IN (SELECT app_user_households())
);

CREATE POLICY plans_update ON plans FOR UPDATE USING (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'plan' AND g.item_id = plans.id
      AND g.grantee_user_id = app_current_user()
      AND g.role IN ('edit', 'admin') AND g.revoked_at IS NULL
  )
) WITH CHECK (
  created_by_user_id = app_current_user()
  OR EXISTS (
    SELECT 1 FROM item_grants g
    WHERE g.item_type = 'plan' AND g.item_id = plans.id
      AND g.grantee_user_id = app_current_user()
      AND g.role IN ('edit', 'admin') AND g.revoked_at IS NULL
  )
);

CREATE POLICY plans_delete ON plans FOR DELETE USING (
  created_by_user_id = app_current_user()
);

-- FK children: coarse "can see the parent" backstop (app enforces editor) ------
-- Each subquery runs under the restricted role, so the parent's own SELECT
-- policy already constrains it. No recursion (child policies never self-ref).
ALTER TABLE meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY meal_ingredients_via_meal ON meal_ingredients FOR ALL
  USING (meal_id IN (SELECT id FROM meals))
  WITH CHECK (meal_id IN (SELECT id FROM meals));

ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_steps_via_meal ON recipe_steps FOR ALL
  USING (meal_id IN (SELECT id FROM meals))
  WITH CHECK (meal_id IN (SELECT id FROM meals));

ALTER TABLE recipe_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_variants_via_meal ON recipe_variants FOR ALL
  USING (meal_id IN (SELECT id FROM meals))
  WITH CHECK (meal_id IN (SELECT id FROM meals));

ALTER TABLE plan_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_dishes FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_dishes_via_plan ON plan_dishes FOR ALL
  USING (plan_id IN (SELECT id FROM plans))
  WITH CHECK (plan_id IN (SELECT id FROM plans));

-- Households ------------------------------------------------------------------
-- Membership rows + the household row are readable by members; the household
-- name is owner-editable. Household CREATION + owner-removes-member run on the
-- PRIVILEGED connection (signup hook / admin-ish flows), so no app-role policy
-- is needed for those. Self-join (acceptInvitation) inserts the caller's own
-- membership row → WITH CHECK user_id = me.
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE households FORCE ROW LEVEL SECURITY;
CREATE POLICY households_select ON households FOR SELECT USING (
  owner_id = app_current_user() OR id IN (SELECT app_user_households())
);
CREATE POLICY households_update ON households FOR UPDATE USING (
  owner_id = app_current_user()
) WITH CHECK (owner_id = app_current_user());

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members FORCE ROW LEVEL SECURITY;
CREATE POLICY household_members_select ON household_members FOR SELECT USING (
  user_id = app_current_user() OR household_id IN (SELECT app_user_households())
);
CREATE POLICY household_members_insert_self ON household_members FOR INSERT WITH CHECK (
  user_id = app_current_user()
);
-- Owner manages other members (role change / removal). Self can leave.
CREATE POLICY household_members_manage ON household_members FOR DELETE USING (
  user_id = app_current_user()
  OR household_id IN (SELECT id FROM households WHERE owner_id = app_current_user())
);

ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invitations FORCE ROW LEVEL SECURITY;
-- Members create + view their household's invitations. Accept-by-token is a
-- public flow handled on the PRIVILEGED connection.
CREATE POLICY household_invitations_member ON household_invitations FOR ALL
  USING (household_id IN (SELECT app_user_households()))
  WITH CHECK (household_id IN (SELECT app_user_households()));

-- Public link shares ----------------------------------------------------------
-- The owner creates/lists/revokes their own links here. Anonymous "anyone with
-- the link" reads use the PRIVILEGED narrow read path (lib/share/*), so they
-- need no app-role SELECT policy.
ALTER TABLE recipe_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_shares_owner ON recipe_shares FOR ALL
  USING (created_by_user_id = app_current_user())
  WITH CHECK (created_by_user_id = app_current_user());

ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_shares_owner ON plan_shares FOR ALL
  USING (created_by_user_id = app_current_user())
  WITH CHECK (created_by_user_id = app_current_user());
