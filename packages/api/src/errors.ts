/**
 * Round 12 — wire-stable `cause.reason` strings. Every TRPCError thrown
 * by the eeatly API carries a structured `cause: { reason, … }`. These
 * constants are the SOURCE OF TRUTH for the strings the client matches
 * on; changing them is a breaking change for both web and mobile, so
 * import from here rather than typing literals.
 *
 * Each block groups by domain so it's easy to see what a procedure
 * can throw. New reasons get added to the union AND a constant; both
 * sides of the wire reference the constant.
 */

// Auth / role
export const UNAUTHENTICATED = "UNAUTHENTICATED" as const;
export const FORBIDDEN_ROLE = "FORBIDDEN_ROLE" as const;

// Household scope
export const NOT_HOUSEHOLD_MEMBER = "NOT_HOUSEHOLD_MEMBER" as const;
export const NOT_HOUSEHOLD_OWNER = "NOT_HOUSEHOLD_OWNER" as const;
export const NOT_OWNER = "NOT_OWNER" as const;
export const CROSS_HOUSEHOLD = "CROSS_HOUSEHOLD" as const;

// Paid-tier / gates
export const UPGRADE_REQUIRED = "UPGRADE_REQUIRED" as const;

// Rate limits
export const RATE_LIMITED = "RATE_LIMITED" as const;

// Generic / discovery
export const NOT_FOUND = "NOT_FOUND" as const;
export const LOG_NOT_FOUND = "LOG_NOT_FOUND" as const;
export const INVALID_INPUT = "INVALID_INPUT" as const;

// Account
export const OWNER_BLOCK = "OWNER_BLOCK" as const;
export const CONFIRMATION_MISMATCH = "CONFIRMATION_MISMATCH" as const;

// Households
export const INVITATION_NOT_FOUND = "INVITATION_NOT_FOUND" as const;
export const INVITATION_EXPIRED = "INVITATION_EXPIRED" as const;
export const INVITATION_ALREADY_USED = "INVITATION_ALREADY_USED" as const;
export const INVITATION_EMAIL_MISMATCH = "INVITATION_EMAIL_MISMATCH" as const;
export const OWNERSHIP_TRANSFER_REQUIRED = "OWNERSHIP_TRANSFER_REQUIRED" as const;
export const MEAL_NAME_COLLISION = "MEAL_NAME_COLLISION" as const;
export const CANNOT_REMOVE_SELF = "CANNOT_REMOVE_SELF" as const;
export const CANNOT_REMOVE_OWNER = "CANNOT_REMOVE_OWNER" as const;
export const NOT_MEMBER = "NOT_MEMBER" as const;
export const SOLE_OWNER = "SOLE_OWNER" as const;

// Meals
export const MEAL_ARCHIVED = "MEAL_ARCHIVED" as const;
export const NO_RECIPE_TEXT = "NO_RECIPE_TEXT" as const;
export const RECIPE_MISSING = "RECIPE_MISSING" as const;

// AI
export const AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR" as const;
export const AI_ERROR = "AI_ERROR" as const;
export const AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE" as const;
export const AUDIO_INVALID_FORMAT = "AUDIO_INVALID_FORMAT" as const;
export const AUDIO_TRANSCRIPTION_FAILED = "AUDIO_TRANSCRIPTION_FAILED" as const;
export const AUDIO_TOO_SHORT_OR_EMPTY = "AUDIO_TOO_SHORT_OR_EMPTY" as const;

// URL preview (Round 16)
export const URL_INVALID = "URL_INVALID" as const;
export const URL_PRIVATE_NETWORK = "URL_PRIVATE_NETWORK" as const;
export const URL_FETCH_FAILED = "URL_FETCH_FAILED" as const;
export const URL_TOO_LARGE = "URL_TOO_LARGE" as const;
export const URL_NO_METADATA = "URL_NO_METADATA" as const;

// Billing
export const BILLING_NOT_CONFIGURED = "BILLING_NOT_CONFIGURED" as const;
export const NO_STRIPE_CUSTOMER = "NO_STRIPE_CUSTOMER" as const;

/**
 * Union of every reason string the API may emit. Useful as a switch
 * target on the client. Specific cause shapes (which extra fields ride
 * alongside `reason`) live in the procedure-level error types — this
 * union is just the discriminator.
 */
export type ErrorReason =
  | typeof UNAUTHENTICATED
  | typeof FORBIDDEN_ROLE
  | typeof NOT_HOUSEHOLD_MEMBER
  | typeof NOT_HOUSEHOLD_OWNER
  | typeof NOT_OWNER
  | typeof CROSS_HOUSEHOLD
  | typeof UPGRADE_REQUIRED
  | typeof RATE_LIMITED
  | typeof NOT_FOUND
  | typeof LOG_NOT_FOUND
  | typeof INVALID_INPUT
  | typeof OWNER_BLOCK
  | typeof CONFIRMATION_MISMATCH
  | typeof INVITATION_NOT_FOUND
  | typeof INVITATION_EXPIRED
  | typeof INVITATION_ALREADY_USED
  | typeof INVITATION_EMAIL_MISMATCH
  | typeof OWNERSHIP_TRANSFER_REQUIRED
  | typeof MEAL_NAME_COLLISION
  | typeof CANNOT_REMOVE_SELF
  | typeof CANNOT_REMOVE_OWNER
  | typeof NOT_MEMBER
  | typeof SOLE_OWNER
  | typeof MEAL_ARCHIVED
  | typeof NO_RECIPE_TEXT
  | typeof RECIPE_MISSING
  | typeof AI_PROVIDER_ERROR
  | typeof AI_ERROR
  | typeof AUDIO_TOO_LARGE
  | typeof AUDIO_INVALID_FORMAT
  | typeof AUDIO_TRANSCRIPTION_FAILED
  | typeof AUDIO_TOO_SHORT_OR_EMPTY
  | typeof URL_INVALID
  | typeof URL_PRIVATE_NETWORK
  | typeof URL_FETCH_FAILED
  | typeof URL_TOO_LARGE
  | typeof URL_NO_METADATA
  | typeof BILLING_NOT_CONFIGURED
  | typeof NO_STRIPE_CUSTOMER;
