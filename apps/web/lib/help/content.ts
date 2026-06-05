import {
  BookOpen,
  Calendar,
  Lightbulb,
  Sparkles,
  Users,
  Utensils,
  type LucideIcon
} from "lucide-react";

/**
 * In-app Help content — the per-feature how-to guides shown in the Help
 * slide-over. Plain data so it lives in the content layer, not the component.
 * Ported from the Tour & Help design handoff (HELP_W).
 *
 *  - `para`  → plain paragraphs
 *  - `list`  → bulleted points
 *  - `steps` → numbered steps
 */
export type HelpItemKind = "para" | "list" | "steps";

export type HelpItem = {
  q: string;
  kind: HelpItemKind;
  body: string[];
};

export type HelpCategory = {
  cat: string;
  icon: LucideIcon;
  items: HelpItem[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    cat: "Getting started",
    icon: Lightbulb,
    items: [
      {
        q: "What is eeatly?",
        kind: "para",
        body: [
          "eeatly is a private memory for your kitchen, a place to log every meal you cook so you can find it again, repeat it, and improve it over time.",
          "It isn't a feed or a recipe website. Nothing is public; everything you see is yours and your kitchen's."
        ]
      },
      {
        q: "Finding your way around",
        kind: "list",
        body: [
          "The left sidebar groups everything into Cook, Capture, and Kitchen.",
          "The top bar holds global search, notifications, and this Help button.",
          "“Log a meal” is always one click away at the top of the sidebar."
        ]
      }
    ]
  },
  {
    cat: "Logging & capturing",
    icon: Utensils,
    items: [
      {
        q: "Log a meal you cooked",
        kind: "steps",
        body: [
          "Click “Log a meal”, or open Capture → Add a meal.",
          "Type the name and choose when you cooked it.",
          "Optionally add a photo, an effort level, and notes for next time.",
          "Save, it appears on Home, in your Library, and in your history."
        ]
      },
      {
        q: "Capture a recipe with AI",
        kind: "steps",
        body: [
          "Open Capture → Capture with AI.",
          "Pick Photo, Text, or Voice.",
          "eeatly fills the name, ingredients, and steps into a draft (and generates a starting recipe when you only give a name).",
          "Review and adjust, then save."
        ]
      },
      {
        q: "Save a link for later",
        kind: "steps",
        body: [
          "Add a source URL when you log a meal, or paste a recipe link.",
          "YouTube, TikTok, Pinterest, and recipe sites are supported.",
          "The recipe view embeds the link so you can cook straight from it."
        ]
      }
    ]
  },
  {
    cat: "Your library",
    icon: BookOpen,
    items: [
      {
        q: "Browse, search & filter",
        kind: "steps",
        body: [
          "Open Library to see every saved meal.",
          "Use the filter chips, Recent, Most cooked, Quick, High effort.",
          "Search by name from the top bar at any time."
        ]
      },
      {
        q: "Recipe detail & shopping list",
        kind: "list",
        body: [
          "Each recipe shows ingredients, steps, effort, and cook count.",
          "Check off ingredients you already have.",
          "Share or copy the remaining items as a shopping list."
        ]
      },
      {
        q: "Edit a recipe by hand",
        kind: "steps",
        body: [
          "Open a recipe and click “Edit recipe”.",
          "Add, edit, reorder, or remove ingredients and steps.",
          "Save, no AI and no credits needed."
        ]
      },
      {
        q: "Refine a recipe with AI",
        kind: "steps",
        body: [
          "Open a recipe and click “Refine with AI”.",
          "Describe the change by text, voice, or photo.",
          "Review the proposed edits as a before/after diff.",
          "Apply to update the recipe, or discard."
        ]
      }
    ]
  },
  {
    cat: "Plans",
    icon: Calendar,
    items: [
      {
        q: "Create an occasion plan",
        kind: "steps",
        body: [
          "Open Plans and create a new plan.",
          "Name the occasion and pick a date, Eid, Diwali, a dinner party.",
          "Add an optional note for the kitchen."
        ]
      },
      {
        q: "Add dishes to a plan",
        kind: "steps",
        body: [
          "Open a plan and choose “Add dish”.",
          "Search your meals and add the ones you want.",
          "Dishes stay in your Library even if you delete the plan."
        ]
      }
    ]
  },
  {
    cat: "Rediscovery",
    icon: Sparkles,
    items: [
      {
        q: "How “worth cooking again” works",
        kind: "list",
        body: [
          "eeatly looks at what you've cooked, how often, and how long it's been.",
          "It surfaces favourites you've neglected and easy wins.",
          "Click a suggestion to open it, or “Log again” straight from Home."
        ]
      }
    ]
  },
  {
    cat: "Kitchen & sharing",
    icon: Users,
    items: [
      {
        q: "Invite someone to your kitchen",
        kind: "steps",
        body: [
          "Open People, or Settings → Members.",
          "Send an invite by email.",
          "When they accept, you can share recipes and plans with them."
        ]
      },
      {
        q: "Roles & leaving a kitchen",
        kind: "list",
        body: [
          "The owner manages members and invitations.",
          "Everyone in a kitchen can log meals and add recipes.",
          "Leave anytime, your recipes stay credited to you."
        ]
      }
    ]
  }
];
