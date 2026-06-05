"use client";

import * as React from "react";
import { Home, PlusCircle, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * First-run welcome modal: a short, skippable 3-step intro. The final slide's
 * primary CTA starts the coached tour. Recreated from the Tour & Help handoff.
 */
export function WelcomeModal({
  onStart,
  onSkip
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const [i, setI] = React.useState(0);
  // The coached tour is desktop-only; on a phone the final slide points at the
  // guides instead of promising a spatial walkthrough.
  const [isDesktop, setIsDesktop] = React.useState(true);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read
    setIsDesktop(window.matchMedia("(min-width: 768px)").matches);
  }, []);
  const slides = [<Slide1 key="1" />, <Slide2 key="2" />, <Slide3 key="3" isDesktop={isDesktop} />];
  const last = i === slides.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to eeatly"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(18,20,15,0.55)] p-4 backdrop-blur-[3px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onSkip();
      }}
    >
      <div className="w-full max-w-[560px] rounded-[22px] border border-[color:var(--border)] bg-background p-7 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.5)] sm:p-[40px_44px_32px]">
        <div className="min-h-[260px] sm:min-h-[300px]">{slides[i]}</div>

        {/* Progress */}
        <div className="my-[22px] flex gap-1.5">
          {slides.map((_, k) => (
            <span
              key={k}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                k <= i ? "bg-primary" : "bg-[color:var(--border)]"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="px-1 py-3 text-[14px] font-semibold text-muted-foreground"
          >
            Skip for now
          </button>
          <div className="flex-1" />
          {i > 0 ? (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="rounded-full border border-[color:var(--border)] px-5 py-3 text-[14px] font-semibold text-foreground"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? onStart() : setI(i + 1))}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[14.5px] font-semibold text-primary-foreground shadow-[0_6px_20px_-8px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
          >
            {last ? (
              <>
                <Sparkles className="h-[17px] w-[17px]" />
                {isDesktop ? "Start the tour" : "Browse the guides"}
              </>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-[18px] font-mono text-[11px] uppercase tracking-[3px] text-muted-foreground">
      {children}
    </p>
  );
}

function Slide1() {
  return (
    <>
      <Eyebrow>A kitchen companion</Eyebrow>
      <div className="mb-[18px] font-serif text-[64px] leading-[0.9] tracking-[-0.03em] text-primary sm:text-[76px]">
        eeatly
      </div>
      <div className="mb-3 font-serif text-[24px] italic leading-[1.25] text-foreground sm:text-[26px]">
        A memory for everything you cook.
      </div>
      <p className="max-w-[420px] text-[15px] leading-[1.55] text-muted-foreground">
        Log a meal, find it again, and cook it better next time. Here&apos;s a quick look at
        the web app.
      </p>
    </>
  );
}

function Slide2() {
  const rows: { icon: LucideIcon; t: string; s: string }[] = [
    { icon: Home, t: "Cook", s: "Home, Plans, Library, and history." },
    { icon: PlusCircle, t: "Capture", s: "Log a meal, capture with AI, or save a link." },
    { icon: Users, t: "Kitchen", s: "Members and settings." }
  ];
  return (
    <>
      <Eyebrow>The layout</Eyebrow>
      <div className="mb-6 font-serif text-[34px] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[40px]">
        One sidebar, three groups.
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((x) => {
          const Icon = x.icon;
          return (
            <div key={x.t} className="flex items-center gap-3.5">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[color:var(--sage-soft)] text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.1px] text-foreground">
                  {x.t}
                </div>
                <div className="mt-px text-[13.5px] text-muted-foreground">{x.s}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Slide3({ isDesktop }: { isDesktop: boolean }) {
  return (
    <>
      <Eyebrow>Ready</Eyebrow>
      <div className="mb-4 font-serif text-[34px] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[40px]">
        {isDesktop ? "Take a quick tour?" : "You're all set."}
      </div>
      <p className="max-w-[440px] text-[15px] leading-[1.55] text-muted-foreground">
        {isDesktop
          ? "A 60-second walkthrough points out each feature, right where it lives. You can skip and explore on your own, Help is always in the top bar."
          : "Tap the ? in the top bar anytime for step-by-step guides on every feature. Explore at your own pace."}
      </p>
    </>
  );
}
