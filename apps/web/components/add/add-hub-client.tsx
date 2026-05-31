"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  CalendarDays,
  ChevronRight,
  Link as LinkIcon,
  Sparkles,
  UserPlus,
  Utensils
} from "lucide-react";

import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

/**
 * Round 29 — Add hub.
 *
 * Capture as a destination, not just an action. Three primary tiles
 * (Log a meal / Capture with AI / Save a link) sit above a smaller
 * "Plans & sharing" row that surfaces existing planning + invite
 * flows. The "Recent imports" section the design draws is omitted —
 * no backend tracks captures as a queryable feed today; rendering a
 * placeholder list would add UI weight without value.
 *
 * Tiles are pure `<Link>` wrappers — keyboard / right-click / middle-
 * click all work for free. The primary tile (forest-on-cream) is
 * "Log a meal I cooked"; the AI and Link tiles share the secondary
 * cream-on-surface treatment.
 */

type TileVariant = "primary" | "secondary";

type TileProps = {
  href: Route;
  title: string;
  subtitle: string;
  kbd?: string;
  icon: React.ReactNode;
  variant?: TileVariant;
};

function CaptureTile({
  href,
  title,
  subtitle,
  kbd,
  icon,
  variant = "secondary"
}: TileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full min-h-[180px] flex-col justify-between gap-3 rounded-[14px] border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-6",
        variant === "primary"
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/95"
          : "border-border bg-[var(--surface)] text-foreground hover:border-[var(--border-strong,var(--border))]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            variant === "primary"
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-[color:var(--sage-soft)] text-primary"
          )}
        >
          {icon}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform group-hover:translate-x-0.5",
            variant === "primary"
              ? "text-primary-foreground/70"
              : "text-muted-foreground"
          )}
        />
      </div>
      <div className="grid gap-2">
        <h3
          className={cn(
            "font-serif text-[24px] leading-[1.1] sm:text-[26px]",
            variant === "primary" ? "text-primary-foreground" : "text-foreground"
          )}
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-[13px] leading-[1.5]",
            variant === "primary"
              ? "text-primary-foreground/85"
              : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
        {kbd ? (
          <kbd
            className={cn(
              "w-fit justify-self-start rounded border px-1.5 py-0.5 font-mono text-[10px]",
              variant === "primary"
                ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80"
                : "border-border bg-[var(--surface-2)] text-muted-foreground"
            )}
            aria-hidden
          >
            {kbd}
          </kbd>
        ) : null}
      </div>
    </Link>
  );
}

export function AddHubClient() {
  return (
    <div className="grid gap-7">
      {/* Editorial hero — italic kicker + display headline + description */}
      <header className="grid gap-2 pt-1">
        <p
          className="font-serif text-[20px] italic text-muted-foreground sm:text-[22px]"
          style={{ letterSpacing: "-0.005em" }}
        >
          Capture,
        </p>
        <h1
          className="font-serif text-[48px] leading-[0.98] text-foreground sm:text-[60px] lg:text-[72px]"
          style={{ letterSpacing: "-0.025em" }}
        >
          without the friction.
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
          Add a meal you cooked, paste a recipe to extract, or photograph a
          handwritten card. Capture once — eeatly does the typing.
        </p>
      </header>

      {/* Primary capture tiles — 3-up */}
      <section aria-labelledby="capture-heading" className="grid gap-4">
        <SectionLabel id="capture-heading">Capture</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CaptureTile
            href={"/add/log" as Route}
            title="Log a meal I cooked"
            subtitle="The fast path — name, when, how it went."
            kbd="G then L"
            icon={<Utensils className="h-5 w-5" />}
            variant="primary"
          />
          <CaptureTile
            href={"/add/ai" as Route}
            title="Capture with AI"
            subtitle="Photo, paste, or voice — extract a recipe automatically."
            kbd="G then A"
            icon={<Sparkles className="h-5 w-5" />}
          />
          <CaptureTile
            href={"/add/ai" as Route}
            title="Save a link"
            subtitle="Paste a YouTube, Instagram, or recipe URL. We'll pull the recipe."
            kbd="G then U"
            icon={<LinkIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* Plans & sharing — 2-up, links to existing surfaces */}
      <section aria-labelledby="plans-heading" className="grid gap-4">
        <SectionLabel id="plans-heading">Plans &amp; sharing</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <CaptureTile
            href={"/plans/new" as Route}
            title="Plan an occasion menu"
            subtitle="Eid, a dinner party, a school-night rotation. Pick dishes from your library."
            kbd="G then P"
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <CaptureTile
            href={"/settings" as Route}
            title="Invite a co-cook"
            subtitle="Share the kitchen. Family member, partner, anyone who cooks with you."
            kbd="G then I"
            icon={<UserPlus className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* "Recent imports" section omitted — no backend feed today.
          A future round can add a query if the signal warrants. */}
    </div>
  );
}
