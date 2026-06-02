/**
 * Single source of truth for the marketing-chrome links — consumed by
 * `<SiteHeader>` and `<SiteFooter>` so the landing, pricing, privacy, and
 * help pages all render the same nav + footer.
 *
 * Primary-nav items resolve as real routes everywhere; the landing page
 * passes `variant="landing"` to `<SiteHeader>`, which swaps the entries that
 * have a `landingHref` for in-page anchors (`#features` / `#pricing`).
 */
export type NavLink = {
  label: string;
  /** Default href used on every page (real route). */
  href: string;
  /** In-page anchor used only on the landing page (`variant="landing"`). */
  landingHref?: string;
};

export const PRIMARY_NAV: NavLink[] = [
  { label: "Features", href: "/#features", landingHref: "#features" },
  { label: "Pricing", href: "/pricing", landingHref: "#pricing" },
  { label: "Help", href: "/help" }
];

export const FOOTER_LINKS: NavLink[] = [
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Help", href: "/help" },
  { label: "Sign in", href: "/sign-in" }
];
