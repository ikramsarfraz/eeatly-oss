-- =============================================================================
-- 0027_refine_sessions.sql — Round 18 Refine: per-device editing sessions
-- =============================================================================
-- Three tables that back the chat-style "Refine recipe" flow. A session
-- is a draft layered on top of a meal; turns are the prompts the user
-- submitted; pending changes are the flattened diff the Review screen
-- renders and the Save mutation commits.
--
-- Authorization model per the design README:
--   - Sessions are per-device-per-recipe-per-user. User A on phone and
--     user A on tablet refining the same recipe is allowed — both run
--     concurrently; whoever saves first wins (last-write-wins is
--     documented as a parking-lot for v2).
--   - Multiple users in the same household do NOT share sessions —
--     uniqueness includes user_id.
--
-- Status lifecycle: 'active' → 'saved' OR 'discarded'. Once non-active,
-- the row stays for analytics. A daily GC job (future round) marks
-- 14-day-stale 'active' sessions as 'abandoned'.
--
-- `proposed` and the `payload` / `before` / `after` JSON columns store
-- the discriminated union defined in `packages/api/src/validators/refine.ts`.
-- Zod parses on the way out; we don't constrain shape at the DB layer.
--
-- Pending changes are denormalised across accepted turns. When the user
-- toggles `accepted` on a turn, the procedure DELETEs that turn's
-- pending rows + re-INSERTs from the accepted set.
--
-- Rollback:
--   DROP TABLE "refine_pending_changes";
--   DROP TABLE "refine_turns";
--   DROP TABLE "refine_sessions";
-- =============================================================================

CREATE TABLE "refine_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  -- Per-install identifier from the mobile client (secure-store UUID).
  -- Web gets a stable cookie when it lands. Required because the
  -- per-active-session uniqueness is scoped per-device.
  "device_id" text NOT NULL,
  -- 'active' | 'saved' | 'discarded' | 'abandoned' (future GC sweep).
  "status" text NOT NULL DEFAULT 'active',
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
  "saved_at" timestamp with time zone,
  "discarded_at" timestamp with time zone
);
--> statement-breakpoint

ALTER TABLE "refine_sessions" ADD CONSTRAINT "refine_sessions_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "refine_sessions" ADD CONSTRAINT "refine_sessions_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- One active session per (meal, user, device). Closed sessions are
-- ignored so the user can start a new session after saving the previous
-- one. Partial unique index on the 'active' status enforces this.
CREATE UNIQUE INDEX "refine_sessions_active_unique_idx"
  ON "refine_sessions" ("meal_id", "user_id", "device_id")
  WHERE "status" = 'active';
--> statement-breakpoint

CREATE INDEX "refine_sessions_user_meal_idx"
  ON "refine_sessions" ("user_id", "meal_id");
--> statement-breakpoint

CREATE TABLE "refine_turns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  -- 0-indexed slot within the session. Used for chat history ordering
  -- and to support a future "edit + resubmit a previous turn" affordance.
  "position" integer NOT NULL,
  -- 'text' | 'voice' | 'photo'.
  "source" text NOT NULL,
  -- User text (transcribed for voice, OCR caption for photo).
  "prompt" text NOT NULL,
  -- R2 URL for voice/photo attachments. NULL for text.
  "attachment_url" text,
  -- PendingChange[] as the AI proposed it for this turn. Stored verbatim
  -- so a user-toggled `accepted=false` doesn't lose the suggestion.
  "proposed" jsonb NOT NULL,
  "accepted" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "refine_turns" ADD CONSTRAINT "refine_turns_session_id_refine_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "refine_sessions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE UNIQUE INDEX "refine_turns_session_position_idx"
  ON "refine_turns" ("session_id", "position");
--> statement-breakpoint

CREATE INDEX "refine_turns_session_idx"
  ON "refine_turns" ("session_id");
--> statement-breakpoint

CREATE TABLE "refine_pending_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "turn_id" uuid NOT NULL,
  -- 'add' | 'change' | 'remove'.
  "kind" text NOT NULL,
  -- 'ingredient' | 'step' | 'meta'.
  "target" text NOT NULL,
  -- Existing-row id for change/remove. NULL for add (the payload
  -- describes what to create).
  "ref_id" text,
  -- For 'change': which field on the target changed.
  "field" text,
  -- Snapshot of the value before this change (for change/remove).
  "before" jsonb,
  -- New value (for change). For add, the full creation payload lives
  -- in `payload` and `after` is left NULL.
  "after" jsonb,
  -- For 'add': the full new object (Partial<Ingredient> | Partial<Step>).
  "payload" jsonb,
  -- For 'add': where to place the new row ("after step 5"). Free-form.
  "where_hint" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "refine_pending_changes" ADD CONSTRAINT "refine_pending_changes_session_id_refine_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "refine_sessions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "refine_pending_changes" ADD CONSTRAINT "refine_pending_changes_turn_id_refine_turns_id_fk"
  FOREIGN KEY ("turn_id") REFERENCES "refine_turns"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "refine_pending_changes_session_idx"
  ON "refine_pending_changes" ("session_id");
--> statement-breakpoint

CREATE INDEX "refine_pending_changes_turn_idx"
  ON "refine_pending_changes" ("turn_id");
