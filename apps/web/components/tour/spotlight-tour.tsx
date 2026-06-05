"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { TOUR_STEPS } from "@/lib/tour/steps";

type Box = { x: number; y: number; w: number; h: number };

/**
 * Coached spotlight overlay. Measures the current step's `[data-tour]` anchor
 * in the live DOM, dims everything else with an SVG mask + pulsing ring, and
 * floats a tooltip beside it. Polls for the anchor (the provider navigates to
 * the step's route first) and auto-advances if it never appears.
 */
export function SpotlightTour({
  index,
  onNext,
  onPrev,
  onClose
}: {
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;
  const last = index === total - 1;
  const PAD = 6;

  const [box, setBox] = React.useState<Box | null>(null);
  const [vp, setVp] = React.useState({ w: 0, h: 0 });
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = React.useState(160);
  const scrolledRef = React.useRef<number | null>(null);
  // Keep the latest onNext without making the measure effect depend on it (the
  // parent recreates it each render, which would restart the poll).
  const onNextRef = React.useRef(onNext);
  React.useEffect(() => {
    onNextRef.current = onNext;
  });

  // "ok" → highlight it; "wait" → not in the DOM yet (keep polling); "skip" →
  // present but hidden/off-screen (e.g. the off-canvas sidebar on mobile), so
  // advance immediately instead of highlighting empty space.
  const measure = React.useCallback((): "ok" | "wait" | "skip" => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    if (!el) return "wait";
    if (scrolledRef.current !== index) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      scrolledRef.current = index;
    }
    const b = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (
      b.width === 0 ||
      b.height === 0 ||
      b.right <= 0 ||
      b.bottom <= 0 ||
      b.left >= vw ||
      b.top >= vh
    ) {
      return "skip";
    }
    setVp({ w: vw, h: vh });
    setBox({ x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2 });
    return "ok";
  }, [step.anchor, index]);

  React.useEffect(() => {
    // Clear the old highlight when the step changes, then re-poll for the new
    // anchor (which may not exist until the route/data settles).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on step change
    setBox(null);
    scrolledRef.current = null;
    let raf = 0;
    let tries = 0;
    const tick = () => {
      const r = measure();
      if (r === "ok") return;
      if (r === "skip") {
        onNextRef.current();
        return;
      }
      if (tries++ < 80) {
        raf = requestAnimationFrame(tick);
      } else {
        // Anchor never showed up (route/data not present) — skip this step.
        onNextRef.current();
      }
    };
    raf = requestAnimationFrame(tick);
    const remeasure = () => measure();
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [measure]);

  React.useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [box, index]);

  if (!box) return null;

  const CARD_W = Math.min(356, vp.w - 32);
  const cy = box.y + box.h / 2;
  const clampX = (x: number) => Math.max(16, Math.min(x, vp.w - CARD_W - 16));
  const clampY = (y: number) => Math.max(16, Math.min(y, vp.h - cardH - 16));

  let place = step.place;
  if (place === "right" && box.x + box.w + 16 + CARD_W > vp.w - 8) place = "bottom";
  if (place === "left" && box.x - CARD_W - 16 < 8) place = "bottom";

  let left: number;
  let top: number;
  if (place === "right") {
    left = box.x + box.w + 16;
    top = clampY(cy - cardH / 2);
  } else if (place === "left") {
    left = box.x - CARD_W - 16;
    top = clampY(cy - cardH / 2);
  } else if (place === "top" && box.y - cardH - 16 > 8) {
    top = box.y - cardH - 14;
    left = clampX(box.x);
  } else {
    top = box.y + box.h + 14;
    left = clampX(box.x);
    if (top + cardH > vp.h - 16) top = clampY(box.y - cardH - 14);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <svg width={vp.w} height={vp.h} className="pointer-events-none absolute left-0 top-0">
        <defs>
          <mask id={`spot-${index}`}>
            <rect x="0" y="0" width={vp.w} height={vp.h} fill="#fff" />
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="12" fill="#000" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vp.w}
          height={vp.h}
          fill="rgba(18,20,15,0.62)"
          mask={`url(#spot-${index})`}
        />
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="12"
          fill="none"
          stroke="var(--wheat, #D9C68C)"
          strokeWidth="2.5"
          style={{ filter: "drop-shadow(0 0 7px rgba(217,198,140,0.5))" }}
        >
          <animate
            attributeName="opacity"
            values="0.55;1;0.55"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      {/* Dim catcher — clicking anywhere advances (matches the design). */}
      <button
        type="button"
        aria-label="Next"
        onClick={onNext}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={{ top, left, width: CARD_W }}
        className="absolute rounded-[18px] border border-[var(--border-soft,var(--border))] bg-[var(--surface)] p-[18px_20px_16px] shadow-[0_22px_50px_-16px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-[9px] flex items-center justify-between">
          <div className="flex items-center gap-[7px] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[1.4px]">
              {step.kicker}
            </span>
          </div>
          <span className="font-mono text-[10.5px] tracking-[0.8px] text-muted-foreground">
            {index + 1} / {total}
          </span>
        </div>
        <div className="mb-2 font-serif text-[24px] leading-[1.15] tracking-[-0.02em] text-foreground">
          {step.title}
        </div>
        <p className="mb-4 text-[13.5px] leading-[1.5] text-muted-foreground">{step.body}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-0.5 py-2 text-[13px] font-semibold text-muted-foreground"
          >
            Skip tour
          </button>
          <div className="flex-1" />
          {index > 0 ? (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-full border border-[color:var(--border)] px-4 py-2.5 text-[13.5px] font-semibold text-foreground"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
          >
            {last ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
