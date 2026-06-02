import type { Route } from "next";

/**
 * Round 26 — static breadcrumb map for the new app shell.
 *
 * Dynamic-segment labels (`Recipe`, `Plan`, etc.) are intentionally
 * static in v1 — resolving the real meal / plan name in the
 * breadcrumb requires a client-side query bound to `pathname`, which
 * we'll plumb in a follow-up round. The R26 spec marks this as
 * "Dynamic resolution is a follow-up."
 *
 * Helpers exported here:
 *
 *   - `getCrumbs(pathname)` — returns the ordered crumb list a
 *     `TopBar` renders via shadcn's `Breadcrumb` primitive. The last
 *     crumb has no `href` (it becomes `<BreadcrumbPage>`); intermediate
 *     crumbs carry `href` and render as `<BreadcrumbLink>` wrapping
 *     a Next `<Link>`.
 *
 *   - `isActiveRoute(pathname, href)` — sidebar-active-state helper.
 *     `pathname === href` for the Home route; `startsWith(href + '/')`
 *     for everything else. Matches the spec's active-state rule
 *     exactly.
 */

export type Crumb = {
  label: string;
  href?: Route;
};

/**
 * Active-state helper for sidebar items. Centralised here so the
 * AppSidebar and any future surface that needs active-state checking
 * (e.g. a mobile tab bar) all read the same logic.
 *
 *   - Home (`/dashboard`) only matches an exact pathname so deep
 *     routes don't all light Home up.
 *   - Other routes match if the current pathname equals the href OR
 *     starts with `href + '/'`. The trailing-slash guard prevents
 *     `/plans-archive` (hypothetical) from matching `/plans`.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

/**
 * Parse the pathname into ordered crumbs. The mapping is intentionally
 * declarative — a small `if/else` chain rather than a generic
 * segment-walking algorithm — so adding a new route is a one-line
 * change and dynamic-segment labels stay obvious.
 *
 * Patterns covered:
 *   `/dashboard`                                  → Home
 *   `/ideas`                                      → Cook / Ideas
 *   `/plans`                                      → Cook / Plans
 *   `/plans/new`                                  → Cook / Plans / New
 *   `/plans/[id]`                                 → Cook / Plans / Plan
 *   `/history`                                    → Cook / Library
 *   `/meal/[id]`                                  → Cook / Library / Recipe
 *   `/meal/[id]/refine`                           → Cook / Library / Recipe / Refine
 *   `/meal/[id]/refine/review`                    → Cook / Library / Recipe / Refine / Review
 *   `/add`                                        → Capture / Add a meal
 *   `/add/log`                                    → Capture / Add a meal / Log a meal
 *   `/add/ai`                                     → Capture / Capture with AI
 *   `/household`                                  → Kitchen / Members
 *   `/settings`                                   → Kitchen / Settings
 *   `/notifications`                              → Inbox (route doesn't exist yet but we leave the map entry so the bell's link target works when added)
 */
export function getCrumbs(pathname: string): Crumb[] {
  // Home is the implicit root — every breadcrumb trail conceptually
  // begins at Home, but the design only renders it explicitly on the
  // dashboard itself. On deeper routes we lead with the group label
  // ("Cook" / "Kitchen") rather than "Home" so the trail reads as a
  // location, not a journey back to the start.
  if (pathname === "/dashboard" || pathname === "/") {
    return [{ label: "Home" }];
  }

  if (pathname === "/ideas") {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Ideas" }
    ];
  }

  if (pathname === "/plans") {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Plans" }
    ];
  }

  if (pathname === "/plans/new") {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Plans", href: "/plans" as Route },
      { label: "New" }
    ];
  }

  if (/^\/plans\/[^/]+$/.test(pathname)) {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Plans", href: "/plans" as Route },
      { label: "Plan" }
    ];
  }

  if (pathname === "/history") {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Library" }
    ];
  }

  if (/^\/meal\/[^/]+$/.test(pathname)) {
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Library", href: "/history" as Route },
      { label: "Recipe" }
    ];
  }

  if (/^\/meal\/[^/]+\/refine$/.test(pathname)) {
    const mealMatch = pathname.match(/^\/meal\/([^/]+)\/refine$/);
    const mealId = mealMatch?.[1] ?? "";
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Library", href: "/history" as Route },
      { label: "Recipe", href: `/meal/${mealId}` as Route },
      { label: "Refine" }
    ];
  }

  if (/^\/meal\/[^/]+\/refine\/review$/.test(pathname)) {
    const mealMatch = pathname.match(/^\/meal\/([^/]+)\/refine\/review$/);
    const mealId = mealMatch?.[1] ?? "";
    return [
      { label: "Cook", href: "/dashboard" as Route },
      { label: "Library", href: "/history" as Route },
      { label: "Recipe", href: `/meal/${mealId}` as Route },
      { label: "Refine", href: `/meal/${mealId}/refine` as Route },
      { label: "Review" }
    ];
  }

  // R29 — Capture group routes. The Add hub (`/add`) is the parent;
  // `/add/log` reads as a deeper-than-hub trail since it's an
  // editorial form surface. AI capture sits parallel to the hub
  // (Capture / Capture with AI), not nested under it, because the
  // sidebar has it as its own destination.
  if (pathname === "/add") {
    return [
      { label: "Capture", href: "/dashboard" as Route },
      { label: "Add a meal" }
    ];
  }

  if (pathname === "/add/log") {
    return [
      { label: "Capture", href: "/dashboard" as Route },
      { label: "Add a meal", href: "/add" as Route },
      { label: "Log a meal" }
    ];
  }

  if (pathname === "/add/ai") {
    return [
      { label: "Capture", href: "/dashboard" as Route },
      { label: "Capture with AI" }
    ];
  }

  if (pathname === "/people") {
    return [
      { label: "Sharing", href: "/dashboard" as Route },
      { label: "People" }
    ];
  }

  if (pathname === "/household") {
    return [
      { label: "Kitchen", href: "/dashboard" as Route },
      { label: "Members" }
    ];
  }

  if (pathname === "/settings") {
    return [
      { label: "Sharing", href: "/dashboard" as Route },
      { label: "Settings" }
    ];
  }

  // R32 — Settings became nested routes. Trail is
  // `Sharing › Settings › <Section>`; the Settings crumb links back to
  // the default (`/settings` → redirects to `/settings/account`).
  if (/^\/settings\/[^/]+$/.test(pathname)) {
    const section = pathname.split("/")[2] ?? "";
    const labels: Record<string, string> = {
      account: "Account",
      plan: "Plan",
      sharing: "Sharing & privacy",
      kitchen: "Kitchen",
      notifications: "Notifications",
      appearance: "Appearance",
      advanced: "Advanced",
      danger: "Danger zone"
    };
    return [
      { label: "Sharing", href: "/dashboard" as Route },
      { label: "Settings", href: "/settings" as Route },
      { label: labels[section] ?? "Settings" }
    ];
  }

  if (pathname === "/notifications") {
    return [{ label: "Inbox" }];
  }

  // Unknown pathname — degrade to a single Home crumb rather than
  // rendering an empty breadcrumb. The page itself still owns its
  // own title; the trail just disappears gracefully.
  return [{ label: "Home" }];
}
