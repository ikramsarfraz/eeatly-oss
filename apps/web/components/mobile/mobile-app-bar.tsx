"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft, Menu, Search } from "lucide-react";

import { MobileSheet, MoreSheetContent } from "@/components/mobile/mobile-sheet";
import { AccountSheet } from "@/components/mobile/account-sheet";
import { authClient } from "@/lib/auth/client";

/**
 * R37 — the shared mobile-web app bar ("actions bar"). Left is a hamburger that
 * opens the nav sheet, or a back chevron when `backHref` is set (section-detail
 * screens). Center is the serif page title. Right is search + the avatar, which
 * opens the Account sheet (profile + Members/Settings/Help + Sign out). Manages
 * the nav + account sheets itself so any screen can drop it in.
 *
 * `userName`/`userEmail` are optional — when omitted the bar reads the session
 * itself (`authClient.useSession`), so any mobile screen can drop in
 * `<MobileAppBar title="…" />` (or with `backHref`) without threading session
 * props through its page.
 */
export function MobileAppBar({
  title,
  backHref,
  userName,
  userEmail
}: {
  title: string;
  /** When set, the left control is a back chevron to this href (detail screens). */
  backHref?: string;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const name = userName ?? session?.user?.name ?? null;
  const email = userEmail ?? session?.user?.email ?? null;
  const [navOpen, setNavOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const initial = (name?.trim()?.charAt(0) || email?.charAt(0) || "?").toUpperCase();

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center gap-2.5 bg-background px-3 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
        {backHref ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.push(backHref as Route)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setNavOpen(true)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-serif text-[20px] tracking-[-0.01em] text-foreground">
          {title}
        </span>
        <Link
          href={"/search" as Route}
          aria-label="Search"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground"
        >
          <Search className="h-[18px] w-[18px]" />
        </Link>
        <button
          type="button"
          aria-label="Your account"
          onClick={() => setAccountOpen(true)}
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px] bg-primary font-serif text-[16px] text-primary-foreground"
        >
          {initial}
        </button>
      </div>

      <MobileSheet open={navOpen} label="Go to" onClose={() => setNavOpen(false)}>
        <MoreSheetContent onClose={() => setNavOpen(false)} />
      </MobileSheet>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} name={name} email={email} />
    </>
  );
}
