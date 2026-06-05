"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { WelcomeModal } from "@/components/tour/welcome-modal";
import { SpotlightTour } from "@/components/tour/spotlight-tour";
import { useToast } from "@/components/providers/toast-provider";
import { TOUR_STEPS } from "@/lib/tour/steps";

/**
 * Orchestrates the in-app onboarding + help surfaces: the first-run welcome
 * modal, the coached spotlight tour (which navigates across routes), and the
 * Help slide-over. One client provider mounted in the dashboard shell; pages
 * reach it via `useTourHelp()`. Mounted once per session (the dashboard layout
 * persists it across route changes, so tour state survives navigation).
 */

const TOUR_SEEN_KEY = "eeatly_tour_seen";

type TourHelpContextValue = {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  startTour: () => void;
  replayWelcome: () => void;
};

const TourHelpContext = React.createContext<TourHelpContextValue | null>(null);

export function useTourHelp(): TourHelpContextValue {
  const ctx = React.useContext(TourHelpContext);
  if (!ctx) {
    return {
      helpOpen: false,
      openHelp: () => {},
      closeHelp: () => {},
      startTour: () => {},
      replayWelcome: () => {}
    };
  }
  return ctx;
}

export function TourHelpProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [helpOpen, setHelpOpen] = React.useState(false);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [tourIndex, setTourIndex] = React.useState<number | null>(null);

  // First-run: show the welcome once (gated on a local flag). Read in an effect
  // so SSR markup stays stable.
  React.useEffect(() => {
    let seen = true;
    try {
      seen = Boolean(window.localStorage.getItem(TOUR_SEEN_KEY));
    } catch {
      seen = true;
    }
    if (!seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount gate
      setShowWelcome(true);
    }
  }, []);

  const markSeen = React.useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  // pathname is read live; keep these as plain closures (recreated each render)
  // so navigation compares against the current route.
  const applyStep = (i: number) => {
    setHelpOpen(false);
    setTourIndex(i);
    const route = TOUR_STEPS[i].route;
    if (route !== pathname) router.push(route);
  };

  const endTour = (completed: boolean) => {
    setTourIndex(null);
    if (completed) {
      showToast({
        variant: "success",
        title: "You're all set",
        description: "Open Help (the ? in the top bar) anytime to replay this tour."
      });
    }
  };

  const startTour = () => {
    markSeen();
    setShowWelcome(false);
    applyStep(0);
  };

  const nextStep = () => {
    if (tourIndex === null) return;
    if (tourIndex < TOUR_STEPS.length - 1) applyStep(tourIndex + 1);
    else endTour(true);
  };

  const prevStep = () => {
    if (tourIndex !== null && tourIndex > 0) applyStep(tourIndex - 1);
  };

  const value = React.useMemo<TourHelpContextValue>(
    () => ({
      helpOpen,
      openHelp: () => {
        setTourIndex(null);
        setHelpOpen(true);
      },
      closeHelp: () => setHelpOpen(false),
      startTour,
      replayWelcome: () => {
        setHelpOpen(false);
        setTourIndex(null);
        setShowWelcome(true);
      }
    }),
    // startTour reads live pathname; refresh the memo on route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [helpOpen, pathname]
  );

  return (
    <TourHelpContext.Provider value={value}>
      {children}
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} onReplayTour={startTour} />
      {showWelcome ? (
        <WelcomeModal
          onStart={startTour}
          onSkip={() => {
            markSeen();
            setShowWelcome(false);
          }}
        />
      ) : null}
      {tourIndex !== null ? (
        <SpotlightTour
          index={tourIndex}
          onNext={nextStep}
          onPrev={prevStep}
          onClose={() => endTour(false)}
        />
      ) : null}
    </TourHelpContext.Provider>
  );
}
