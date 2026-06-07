"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { HelpCircle, LogOut, MessageSquare, Settings, Sparkles, Users, X } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { MobileSheet, SheetRow } from "@/components/mobile/mobile-sheet";
import { useTourHelp } from "@/components/tour/tour-help-provider";

/**
 * R37 mobile-web — the Account sheet, opened by tapping the top-bar avatar.
 * Profile header + account destinations + Sign out (the mobile home for
 * signing out, which the bottom-tab "More" sheet didn't cover).
 */
export function AccountSheet({
  open,
  onClose,
  name,
  email,
  onSendFeedback
}: {
  open: boolean;
  onClose: () => void;
  name: string | null;
  email: string | null;
  /** Opens the feedback dialog (mounted by the parent app bar, so it survives
   *  this sheet closing). */
  onSendFeedback: () => void;
}) {
  const router = useRouter();
  const { openHelp, replayWelcome } = useTourHelp();
  const display = name?.trim() || email || "Your account";
  const initial = (display.charAt(0) || "?").toUpperCase();

  const go = (href: Route) => {
    onClose();
    router.push(href);
  };

  // Close the sheet first, then run the action. The Help panel, Welcome modal,
  // and Feedback dialog all mount above this sheet (in the app shell / app bar),
  // so dismissing the sheet first avoids stacked overlays.
  const runAndClose = (fn: () => void) => {
    onClose();
    fn();
  };

  const signOut = async () => {
    onClose();
    try {
      await authClient.signOut();
    } finally {
      // Hard navigation so the cleared session cookie takes effect.
      window.location.assign("/sign-in");
    }
  };

  return (
    <MobileSheet open={open} onClose={onClose}>
      <div className="flex items-center gap-3 px-2 pb-3 pt-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-primary font-serif text-[19px] text-primary-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">{display}</span>
          {email && <span className="block truncate text-[12.5px] text-muted-foreground">{email}</span>}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-2)] text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="pt-1">
        <SheetRow icon={<Users className="h-5 w-5" />} label="Members & sharing" onClick={() => go("/kitchen" as Route)} />
        <SheetRow icon={<Settings className="h-5 w-5" />} label="Settings" onClick={() => go("/settings" as Route)} />
        <div className="my-1.5 h-px bg-border" />
        <SheetRow icon={<HelpCircle className="h-5 w-5" />} label="Help & guides" onClick={() => runAndClose(openHelp)} />
        <SheetRow icon={<MessageSquare className="h-5 w-5" />} label="Send feedback" onClick={() => runAndClose(onSendFeedback)} />
        <SheetRow icon={<Sparkles className="h-5 w-5" />} label="Show me around" onClick={() => runAndClose(replayWelcome)} />
        <div className="my-1.5 h-px bg-border" />
        <SheetRow danger icon={<LogOut className="h-5 w-5" />} label="Sign out" onClick={signOut} />
      </div>
    </MobileSheet>
  );
}
