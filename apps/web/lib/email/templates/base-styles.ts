/**
 * Shared eeatly transactional email styles (inline for client compatibility).
 *
 * Single source of truth for email branding — every template imports from
 * here so the palette, type scale, and button styling stay identical across
 * the whole mail program. The shared chrome (wordmark header + footer) lives
 * in `./email-layout`.
 */

/** Brand palette — one set, used by every template. */
export const BRAND = {
  /** Warm cream page background. */
  cream: "#f7f5ee",
  /** Primary ink for body copy. */
  ink: "#1f2320",
  /** eeatly green — buttons, links, the wordmark. */
  green: "#2f6f58",
  /** On-green text (buttons). */
  onGreen: "#f9fffb",
  /** Muted text — captions, fallbacks, footer. */
  muted: "#6b746e",
  /** Hairline dividers. */
  hairline: "#e4e1d6"
} as const;

export const emailBody = {
  backgroundColor: BRAND.cream,
  color: BRAND.ink,
  fontFamily: "Inter, Arial, sans-serif"
};

export const emailContainer = {
  margin: "0 auto",
  padding: "32px 20px",
  maxWidth: "520px"
};

export const emailHeading = {
  fontSize: "26px",
  lineHeight: "1.25",
  margin: "0 0 14px"
};

export const emailText = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 12px"
};

export const emailButton = {
  display: "inline-block",
  padding: "12px 20px",
  backgroundColor: BRAND.green,
  color: BRAND.onGreen,
  textDecoration: "none",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "600" as const
};

/** Link rendered in eeatly green. */
export const emailLink = {
  color: BRAND.green
};

/** Small muted copy — fallback links, fine print. */
export const emailSmall = {
  fontSize: "12.5px",
  lineHeight: "1.55",
  color: BRAND.muted,
  margin: "0 0 8px",
  wordBreak: "break-all" as const
};
