import "server-only";

import { getServerEnv } from "@/lib/env/server";

/**
 * Per-category email sender identities.
 *
 * Each kind of mail we send has a deliberate From alias + Reply-To, so the
 * inbox shows correct branding ("eeatly Billing", "eeatly Security", …) and
 * stray replies land somewhere useful. The mapping below is the source of
 * truth; callers ask for a `MailIdentity` and never hardcode an address.
 *
 *   Identity         From              Reply-To     Notes
 *   ───────────────  ────────────────  ───────────  ───────────────────────
 *   welcome          hello@            support@     signup / welcome / verify
 *   invitation       hello@            support@     user invites a teammate
 *   password_reset   no-reply@         support@     automated
 *   security         security@         support@     new-device / pwd changed
 *   billing          billing@          billing@     plan lifecycle, receipts
 *   support          support@          support@     support + feedback replies
 *   notification     no-reply@         support@     activity / digest
 *   marketing        hello@            hello@        announcements (needs unsub)
 *   newsletter       news@             hello@        campaigns (future stream)
 *
 * Resend lets a *verified domain* send from any local-part, so once
 * `EMAIL_DOMAIN` points at a verified domain, every alias above works with no
 * per-address setup. Until then (local dev / Resend test mode, where only
 * `onboarding@resend.dev` may send) we fall back to the single `EMAIL_FROM`
 * for the From and still attach a sensible Reply-To.
 */
export type MailIdentity =
  | "welcome"
  | "invitation"
  | "password_reset"
  | "security"
  | "billing"
  | "support"
  | "notification"
  | "marketing"
  | "newsletter";

type SenderSpec = {
  /** Local-part of the From address (before "@domain"). */
  fromLocal: string;
  /** Display name shown in the recipient's inbox — the brand. */
  fromName: string;
  /** Local-part of the Reply-To address. */
  replyLocal: string;
};

const REGISTRY: Record<MailIdentity, SenderSpec> = {
  welcome: { fromLocal: "hello", fromName: "eeatly", replyLocal: "support" },
  invitation: { fromLocal: "hello", fromName: "eeatly", replyLocal: "support" },
  password_reset: { fromLocal: "no-reply", fromName: "eeatly", replyLocal: "support" },
  security: { fromLocal: "security", fromName: "eeatly Security", replyLocal: "support" },
  billing: { fromLocal: "billing", fromName: "eeatly Billing", replyLocal: "billing" },
  support: { fromLocal: "support", fromName: "eeatly Support", replyLocal: "support" },
  notification: { fromLocal: "no-reply", fromName: "eeatly", replyLocal: "support" },
  marketing: { fromLocal: "hello", fromName: "eeatly", replyLocal: "hello" },
  newsletter: { fromLocal: "news", fromName: "eeatly", replyLocal: "hello" }
};

const DEFAULT_DOMAIN = "eeatly.com";

/** Resend's shared test domain — only `onboarding@resend.dev` may send. */
const RESEND_TEST_DOMAIN = "resend.dev";

function parseEmailAddress(value: string): { name?: string; email: string } | null {
  const angle = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angle) {
    return { name: angle[1]?.trim() || undefined, email: angle[2].trim() };
  }
  const trimmed = value.trim();
  return trimmed.includes("@") ? { email: trimmed } : null;
}

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

export type ResolvedSender = {
  /** RFC-5322 From, e.g. `eeatly Billing <billing@eeatly.com>`. */
  from: string;
  /** Reply-To address, e.g. `support@eeatly.com`. */
  replyTo: string;
};

/**
 * Resolve the From + Reply-To for a category of mail.
 *
 * Domain resolution: explicit `EMAIL_DOMAIN` wins; otherwise we derive it from
 * `EMAIL_FROM`; otherwise the brand default (`eeatly.com`). Per-alias From is
 * only used when we can actually send from arbitrary local-parts — i.e. an
 * explicit `EMAIL_DOMAIN`, or an `EMAIL_FROM` on a real (non-resend.dev)
 * domain. In Resend test mode the literal `EMAIL_FROM` is kept as the From.
 */
export function getMailSender(identity: MailIdentity): ResolvedSender {
  const { EMAIL_DOMAIN, EMAIL_FROM } = getServerEnv();
  const spec = REGISTRY[identity];

  const explicitDomain = EMAIL_DOMAIN?.trim() || null;
  const legacy = EMAIL_FROM ? parseEmailAddress(EMAIL_FROM) : null;
  const legacyDomain = legacy ? domainOf(legacy.email) : null;

  const domain =
    explicitDomain ??
    (legacyDomain && legacyDomain !== RESEND_TEST_DOMAIN ? legacyDomain : DEFAULT_DOMAIN);

  const canUseAliases =
    explicitDomain !== null || (legacyDomain !== null && legacyDomain !== RESEND_TEST_DOMAIN);

  const replyTo = `${spec.replyLocal}@${domain}`;

  if (canUseAliases) {
    return { from: `${spec.fromName} <${spec.fromLocal}@${domain}>`, replyTo };
  }

  // Test/dev fallback: keep the single configured sender verbatim, but still
  // attach the category Reply-To (harmless, and useful once the domain ships).
  return { from: EMAIL_FROM ?? `${spec.fromName} <${spec.fromLocal}@${domain}>`, replyTo };
}

/**
 * The plain Reply-To contact address for a category — handy for templates that
 * surface a "questions? write to …" line so body branding matches the sender.
 */
export function getContactEmail(identity: MailIdentity): string {
  return getMailSender(identity).replyTo;
}
