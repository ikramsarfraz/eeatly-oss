import type { Route } from "next";

/**
 * Coached spotlight tour steps. Each step navigates to `route`, highlights the
 * element marked `data-tour="<anchor>"`, and shows a tooltip. Kept to anchors
 * that reliably exist on static routes; the engine gracefully skips a step
 * whose anchor never appears (e.g. an empty Home with no rediscover card).
 *
 * Ported/adapted from the Tour & Help handoff (TOUR_W), scoped to the real app.
 */
export type TourPlacement = "right" | "left" | "top" | "bottom";

export type TourStep = {
  anchor: string;
  route: Route;
  place: TourPlacement;
  kicker: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "sidebar",
    route: "/home" as Route,
    place: "right",
    kicker: "Navigation",
    title: "Everything in one rail.",
    body: "Your kitchen is organised into Cook, Capture, and Kitchen. Jump to any surface from here."
  },
  {
    anchor: "log-cta",
    route: "/home" as Route,
    place: "right",
    kicker: "Log a meal",
    title: "Two clicks to log.",
    body: "The fastest path in the whole app. Log what you cooked and it lands on Home, Library, and your history."
  },
  {
    anchor: "rediscover",
    route: "/home" as Route,
    place: "top",
    kicker: "Rediscover",
    title: "Nudges to cook again.",
    body: "Home resurfaces good meals you haven't made in a while, so deciding what to cook is easy."
  },
  {
    anchor: "search",
    route: "/home" as Route,
    place: "bottom",
    kicker: "Search",
    title: "Find anything, fast.",
    body: "Search meals, plans, and ingredients from the top bar, or press the search button anytime."
  },
  {
    anchor: "capture-cards",
    route: "/add" as Route,
    place: "top",
    kicker: "Capture",
    title: "Capture how you cook.",
    body: "Add a meal by hand, or let AI lift a recipe from a photo, voice note, or text."
  },
  {
    anchor: "nav-library",
    route: "/library" as Route,
    place: "right",
    kicker: "Library",
    title: "Your whole cookbook.",
    body: "Everything you've saved, searchable and filterable. Click any meal to open the recipe."
  },
  {
    anchor: "plans-list",
    route: "/plans" as Route,
    place: "top",
    kicker: "Plans",
    title: "Occasion menus.",
    body: "Group the dishes for an occasion under one date, Eid, Diwali, or a dinner party."
  },
  {
    anchor: "help-btn",
    route: "/home" as Route,
    place: "bottom",
    kicker: "Help",
    title: "Help, one click away.",
    body: "The ? opens guides for every feature. You can replay this tour anytime, too."
  }
];
