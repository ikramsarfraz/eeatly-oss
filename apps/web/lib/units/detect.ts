/**
 * Measurement-system inference — pure, header-free, unit-testable.
 *
 * The product stores recipe quantities as free-form strings ("400 g",
 * "1 cup") and never parses them; this preference is therefore an
 * AI-instruction lever (bias capture + Refine output toward the cook's
 * system), not a converter. We infer a sensible default ONCE at signup
 * and let the user flip it in Settings.
 *
 * Signal priority (most → least reliable):
 *   1. Geo country (Vercel `x-vercel-ip-country`) — the user's actual
 *      location at signup.
 *   2. Accept-Language region subtag (`en-US` → US) — a decent fallback,
 *      though a US expat abroad still reads `en-US`.
 *   3. Default → metric (the global majority).
 */

export type MeasurementSystem = "metric" | "imperial";

export const MEASUREMENT_SYSTEMS = ["metric", "imperial"] as const;

/**
 * ISO 3166-1 alpha-2 codes for the only countries that use imperial/US
 * customary units day-to-day. Everyone else defaults to metric.
 *   - US — United States
 *   - LR — Liberia
 *   - MM — Myanmar
 * (The UK is deliberately metric here: recipes there are overwhelmingly
 * metric even though road signs use miles.)
 */
const IMPERIAL_COUNTRIES = new Set(["US", "LR", "MM"]);

/** Coerce an arbitrary string to a valid MeasurementSystem, or null. */
export function asMeasurementSystem(value: unknown): MeasurementSystem | null {
  return value === "metric" || value === "imperial" ? value : null;
}

/**
 * Pull the region subtag out of the first language tag in an
 * `Accept-Language` header. `"en-US,en;q=0.9"` → `"US"`. Returns null
 * when there's no region subtag (`"en"`, `"fr"`).
 */
function regionFromAcceptLanguage(acceptLanguage: string): string | null {
  const first = acceptLanguage.split(",")[0]?.trim();
  if (!first) return null;
  // Strip a quality value if it somehow rode along on the first tag.
  const tag = first.split(";")[0]?.trim();
  if (!tag) return null;
  const parts = tag.split("-");
  // BCP-47: language[-script][-region]. The region is the first 2-letter
  // (alpha) subtag after the language — handle `zh-Hant-TW` too.
  for (let i = 1; i < parts.length; i += 1) {
    const sub = parts[i];
    if (/^[A-Za-z]{2}$/.test(sub)) return sub.toUpperCase();
  }
  return null;
}

/**
 * Infer the default measurement system from request signals. Both inputs
 * are optional; pass whatever the request actually carried.
 */
export function inferMeasurementSystem(signals: {
  country?: string | null;
  acceptLanguage?: string | null;
}): MeasurementSystem {
  const country = signals.country?.trim().toUpperCase();
  if (country && country.length === 2) {
    return IMPERIAL_COUNTRIES.has(country) ? "imperial" : "metric";
  }

  const region = signals.acceptLanguage
    ? regionFromAcceptLanguage(signals.acceptLanguage)
    : null;
  if (region) {
    return IMPERIAL_COUNTRIES.has(region) ? "imperial" : "metric";
  }

  return "metric";
}
