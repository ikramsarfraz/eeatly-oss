-- =============================================================================
-- 0035_grant_roles.sql — per-grant permission level
-- =============================================================================
-- 'view' | 'edit' | 'admin' on each item_grants row. Lets a share carry an
-- edit/admin permission so non-owners can edit the owner's item in place,
-- not just fork a copy.
--   - view  : read-only (the prior behavior — every existing grant)
--   - edit  : edit the item in place; can't manage sharing
--   - admin : edit + manage who has access; owner alone can delete
--
-- Defaults to 'view', and existing rows take the default, so the migration
-- preserves the current read-only semantics for everyone already shared with.
--
-- Rollback: ALTER TABLE "item_grants" DROP COLUMN IF EXISTS "role";
-- =============================================================================

ALTER TABLE "item_grants"
  ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'view';
