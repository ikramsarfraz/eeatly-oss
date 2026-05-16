import { z } from "zod";

/**
 * Round 18 — validators for the Refine recipe (AI-prompted editing) flow.
 *
 * Shared between the web tRPC procedures and the mobile client so the
 * client can construct payloads with the same shape the server expects.
 * The discriminated union below is the wire-format for `PendingChange`,
 * which is the unit of work for both the AI proposal stream and the
 * final Save mutation.
 *
 * Quantity strings stay free-form ("400 g", "½ tsp"); the system never
 * parses them into number+unit. Time strings on steps are similarly
 * verbatim ("10 min · then 20 min rest").
 */

/** Per-device per-recipe-per-user session id from `startSession`. */
export const sessionIdSchema = z.string().uuid();

/** Per-install device id supplied by the client (mobile: SecureStore UUID;
 *  web: stable cookie when the surface lands). Free-form but bounded. */
export const deviceIdSchema = z
  .string()
  .min(1, "Device id required.")
  .max(128, "Device id too long.");

/** The three refine input modes. */
export const refineSourceSchema = z.enum(["text", "voice", "photo"]);
export type RefineSource = z.infer<typeof refineSourceSchema>;

/** What the change targets — kept narrow so the apply step can switch
 *  on a single field instead of a free-form type tag. */
export const refineTargetSchema = z.enum(["ingredient", "step", "meta"]);
export type RefineTarget = z.infer<typeof refineTargetSchema>;

/** Shape of a single ingredient. Mirrors `meal_ingredients` columns; all
 *  fields are optional on `payload` because the AI may only supply a
 *  partial diff (just a new name + qty, leave position to the server). */
export const ingredientPayloadSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  quantityString: z.string().max(120).optional(),
  prepNote: z.string().max(200).nullable().optional(),
  position: z.number().int().min(0).optional()
});
export type IngredientPayload = z.infer<typeof ingredientPayloadSchema>;

/** Shape of a single recipe step. */
export const stepPayloadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  time: z.string().max(120).nullable().optional(),
  body: z.string().max(4000).optional(),
  ingredientIds: z.array(z.string()).max(50).optional(),
  position: z.number().int().min(0).optional()
});
export type StepPayload = z.infer<typeof stepPayloadSchema>;

/** Meta changes affect derived fields on the meal itself (effort tier,
 *  recipe text fallback, etc.). v1 ships with no AI-driven meta changes;
 *  the schema accepts them so the rule engine + future flows have a
 *  place to slot through. */
export const metaPayloadSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    notes: z.string().max(2000).nullable().optional(),
    recipeText: z.string().max(20_000).nullable().optional(),
    recipeSourceUrl: z.string().url().nullable().optional()
  })
  .strict();
export type MetaPayload = z.infer<typeof metaPayloadSchema>;

/**
 * `PendingChange` discriminated union — the unit of work for every step
 * of the refine pipeline (AI proposes → user toggles accept → save
 * applies). The variants are intentionally narrow so the apply path can
 * switch on `kind` + `target` without a bag-of-fields runtime check.
 */
export const pendingChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("add"),
    target: refineTargetSchema,
    payload: z.union([
      ingredientPayloadSchema,
      stepPayloadSchema,
      metaPayloadSchema
    ]),
    /** Optional placement hint for adds (e.g. "after step 5"). */
    whereHint: z.string().max(120).optional()
  }),
  z.object({
    id: z.string(),
    kind: z.literal("change"),
    target: refineTargetSchema,
    /** Existing row id this change targets. For `target='meta'` use the
     *  meal id; for ingredient/step this is the row id from the
     *  respective table. */
    refId: z.string(),
    /** Which field changed. */
    field: z.string().min(1).max(80),
    before: z.unknown(),
    after: z.unknown()
  }),
  z.object({
    id: z.string(),
    kind: z.literal("remove"),
    target: refineTargetSchema,
    refId: z.string(),
    before: z.unknown()
  })
]);
export type PendingChange = z.infer<typeof pendingChangeSchema>;

/** The AI model's response for a single proposal turn. */
export const proposeChangesResponseSchema = z.object({
  proposed: z.array(pendingChangeSchema).max(50),
  /** Optional one-liner from the model describing what it did. */
  rationale: z.string().max(400).optional()
});
export type ProposeChangesResponse = z.infer<
  typeof proposeChangesResponseSchema
>;

/** Inputs for the tRPC procedures. */
export const startSessionInputSchema = z.object({
  mealId: z.string().uuid(),
  deviceId: deviceIdSchema
});
export type StartSessionInput = z.infer<typeof startSessionInputSchema>;

export const submitTextTurnInputSchema = z.object({
  sessionId: sessionIdSchema,
  prompt: z.string().trim().min(1, "Type a prompt first.").max(2000)
});
export type SubmitTextTurnInput = z.infer<typeof submitTextTurnInputSchema>;

export const submitVoiceTurnInputSchema = z.object({
  sessionId: sessionIdSchema,
  audioBase64: z
    .string()
    .min(1, "Missing audio data.")
    .max(35 * 1024 * 1024, "Audio file too large."),
  mediaType: z.enum([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/flac"
  ]),
  fileName: z.string().max(180).optional()
});
export type SubmitVoiceTurnInput = z.infer<typeof submitVoiceTurnInputSchema>;

export const submitPhotoTurnInputSchema = z.object({
  sessionId: sessionIdSchema,
  imageBase64: z
    .string()
    .min(1, "Missing image data.")
    .max(15 * 1024 * 1024, "Image too large."),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ])
});
export type SubmitPhotoTurnInput = z.infer<typeof submitPhotoTurnInputSchema>;

export const toggleTurnAcceptedInputSchema = z.object({
  sessionId: sessionIdSchema,
  turnId: z.string().uuid(),
  accepted: z.boolean()
});
export type ToggleTurnAcceptedInput = z.infer<
  typeof toggleTurnAcceptedInputSchema
>;

export const sessionOnlyInputSchema = z.object({
  sessionId: sessionIdSchema
});
export type SessionOnlyInput = z.infer<typeof sessionOnlyInputSchema>;

/** Heads-up severity. `info` is non-blocking ambient context; `warn`
 *  flags something the user probably wants to override before saving. */
export const headsUpSeveritySchema = z.enum(["info", "warn"]);
export type HeadsUpSeverity = z.infer<typeof headsUpSeveritySchema>;

export const headsUpSchema = z.object({
  id: z.string(),
  severity: headsUpSeveritySchema,
  title: z.string(),
  body: z.string(),
  suggestedAction: z
    .object({
      label: z.string(),
      payload: z.unknown()
    })
    .optional()
});
export type HeadsUp = z.infer<typeof headsUpSchema>;
