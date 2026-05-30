"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTheme } from "next-themes";
import "./marketing.css";

/**
 * Marketing landing page — design handoff "eeatly Marketing".
 * Warm-cream editorial long-scroll, light + dark (via next-themes). All
 * visual styling lives in `marketing.css` scoped under `.mkt`. The hero
 * phone auto-cycles through representative app screens; the device-screen
 * contents are illustrative per the handoff.
 */

/* ─── Inline icons (stroke, currentColor) ──────────────────────── */
const arrow = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
);
const check = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const mic = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
);
const sparkle = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" /></svg>
);
const users = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
);
const phoneI = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
);
const laptopI = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
);
const globe = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
);
const camera = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>
);
const linkI = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19" /></svg>
);
const planIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 18h2" /></svg>
);
const shareIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
const moon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);
const sun = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);

/* ─── Brand wordmark (uses scoped .brand-wordmark tokens) ───────── */
function BrandWordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="brand-wordmark" style={{ fontSize: size }} aria-label="eeatly">
      <span className="bw-ee" aria-hidden>e</span>
      <span className="bw-ee" aria-hidden>e</span>
      <span className="bw-atly" aria-hidden>a</span>
      <span className="bw-atly" aria-hidden>t</span>
      <span className="bw-atly" aria-hidden>l</span>
      <span className="bw-atly" aria-hidden>y</span>
      <span className="bw-dot" aria-hidden />
    </span>
  );
}

/* ─── Meal tile (hashed warm palette + monogram) ───────────────── */
const MEAL_PALETTES = [
  { bg: "#D7DEC8", fg: "#2E5739", dot: "#A8B79A" },
  { bg: "#E9D6C2", fg: "#7C3F1F", dot: "#D2A984" },
  { bg: "#E2DDC4", fg: "#665225", dot: "#C8B98B" },
  { bg: "#CBD9CF", fg: "#2E4F45", dot: "#9DB1A6" },
  { bg: "#E5D2CE", fg: "#7A3D3D", dot: "#C9A8A4" },
  { bg: "#D4D7E0", fg: "#3A4566", dot: "#A9AEC0" }
];
function mealHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function MealTile({ name, fontSize = 64, radius = 10 }: { name: string; fontSize?: number; radius?: number }) {
  const p = MEAL_PALETTES[mealHash(name) % MEAL_PALETTES.length];
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: "100%", height: "100%", background: p.bg, color: p.fg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", borderRadius: radius }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${p.dot}55 1px, transparent 1.4px)`, backgroundSize: "14px 14px", opacity: 0.55 }} />
      <span style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize, fontStyle: "italic", lineHeight: 0.9, letterSpacing: "-0.04em", position: "relative", zIndex: 1, marginTop: "-0.08em" }}>{letter}</span>
    </div>
  );
}

/* ─── iOS device frame ─────────────────────────────────────────── */
function IOSDevice({ width = 252, height = 540, children }: { width?: number; height?: number; children: React.ReactNode }) {
  const s = width / 393;
  const bezelW = 14 * s;
  return (
    <div style={{ width: width + bezelW, height: height + bezelW, background: "#1a1a16", borderRadius: 56 * s, padding: 7 * s, boxShadow: "0 30px 70px -28px rgba(20,20,15,0.45), inset 0 0 0 1px rgba(255,255,255,0.05)" }}>
      <div style={{ width: "100%", height: "100%", background: "var(--cream)", borderRadius: 50 * s, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 8 * s, left: "50%", transform: "translateX(-50%)", width: 78 * s, height: 20 * s, background: "#0a0a08", borderRadius: 99, zIndex: 10 }} />
        {children}
      </div>
    </div>
  );
}

/* ─── Phone app screens (illustrative) ─────────────────────────── */
const TAB_BAR = (
  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, borderTop: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--surface) 90%, transparent)", display: "flex", alignItems: "center", justifyContent: "space-around", color: "var(--ink3)" }}>
    {[home(), book(), plusC(), searchI()].map((ic, i) => (
      <span key={i} style={{ color: i === 0 ? "var(--forest)" : "var(--ink3)" }}>{ic}</span>
    ))}
  </div>
);
function home() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" /></svg>;
}
function book() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 012-2h13v17H6a2 2 0 00-2 2V5z" /><path d="M6 18h13" /></svg>;
}
function plusC() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
}
function searchI() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
}

const screenWrap: React.CSSProperties = { position: "absolute", inset: 0, padding: "44px 16px 60px", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" };

function HomeScreen() {
  const meals = ["Biryani", "Lasagna", "Khichdi", "Tacos al pastor", "Shakshuka", "Dal tadka"];
  return (
    <div style={screenWrap}>
      <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 24, letterSpacing: "-0.02em", marginBottom: 2 }}>Good evening, Sara</div>
      <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 16 }}>6 dishes cooked this week</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {meals.map((m) => (
          <div key={m}>
            <div style={{ aspectRatio: "1 / 1" }}><MealTile name={m} fontSize={44} /></div>
            <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>{m}</div>
          </div>
        ))}
      </div>
      {TAB_BAR}
    </div>
  );
}
function AddScreen() {
  const opts = [
    { ic: camera, label: "Photo", sub: "Snap handwritten notes" },
    { ic: mic, label: "Voice", sub: "Record the method" },
    { ic: linkI, label: "Link", sub: "Paste a recipe URL" }
  ];
  return (
    <div style={screenWrap}>
      <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 24, letterSpacing: "-0.02em", marginBottom: 16 }}>Add a recipe</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {opts.map((o) => (
          <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", border: "1px solid var(--border-soft)", borderRadius: 14, background: "var(--surface)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sage-bg)", color: "var(--forest)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{o.ic}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink2)" }}>{o.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {TAB_BAR}
    </div>
  );
}
function RecipeScreen() {
  return (
    <div style={{ ...screenWrap, padding: "44px 0 60px" }}>
      <div style={{ height: 150, margin: "0 0 14px" }}><MealTile name="Biryani" fontSize={88} radius={0} /></div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 22, letterSpacing: "-0.02em" }}>Nani&apos;s Chicken Biryani</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", fontFamily: "var(--font-mono-loaded), monospace", letterSpacing: 0.6, margin: "4px 0 14px" }}>ADDED BY NANI · COOKED 8×</div>
        {["Basmati rice", "Chicken thighs", "Yogurt + spices", "Fried onions"].map((ing) => (
          <div key={ing} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid var(--border-soft)" }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--forest)" }} />{ing}
          </div>
        ))}
      </div>
      {TAB_BAR}
    </div>
  );
}
function RefineScreen() {
  return (
    <div style={screenWrap}>
      <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 22, letterSpacing: "-0.02em", marginBottom: 14 }}>Refine with AI</div>
      <div style={{ alignSelf: "flex-end", marginLeft: "auto", maxWidth: "78%", background: "var(--forest)", color: "var(--forest-text)", padding: "9px 13px", borderRadius: "14px 14px 4px 14px", fontSize: 12.5, marginBottom: 12 }}>Add more heat and halve the recipe</div>
      <div style={{ maxWidth: "86%", background: "var(--surface)", border: "1px solid var(--border-soft)", padding: "12px 13px", borderRadius: "14px 14px 14px 4px" }}>
        <div style={{ fontSize: 9, fontFamily: "var(--font-mono-loaded), monospace", letterSpacing: 1.4, color: "var(--ink3)", marginBottom: 6 }}>SUGGESTED CHANGES</div>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>+2 green chilies · ½ all quantities · 4 servings → 2</div>
      </div>
      {TAB_BAR}
    </div>
  );
}

/* ─── Web app shell + screens (the available product) ──────────── */
function WebSidebar({ active }: { active: string }) {
  const nav = [
    { ic: home(), label: "Home" },
    { ic: book(), label: "Library" },
    { ic: planIcon, label: "Plans" },
    { ic: shareIcon, label: "Shared" }
  ];
  return (
    <div style={{ width: 134, flexShrink: 0, borderRight: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--paper) 60%, var(--cream))", padding: "16px 11px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ paddingLeft: 4 }}><BrandWordmark size={21} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((n) => {
          const on = n.label === active;
          return (
            <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: on ? "var(--forest)" : "var(--ink2)", background: on ? "var(--sage-bg)" : "transparent" }}>
              <span style={{ display: "inline-flex", width: 16, height: 16 }}>{n.ic}</span>{n.label}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 99, background: "var(--forest)", color: "var(--forest-text)", fontSize: 12, fontWeight: 600 }}>+ New recipe</div>
    </div>
  );
}

function WebRecipe() {
  return (
    <div className="browser-app" style={{ display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" }}>
      <WebSidebar active="Library" />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: "40%", flexShrink: 0 }}><MealTile name="Nani's Biryani" fontSize={110} radius={0} /></div>
        <div style={{ flex: 1, padding: "20px 22px", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 25, letterSpacing: "-0.02em", lineHeight: 1.05 }}>Nani&apos;s Chicken Biryani</div>
          <div style={{ fontSize: 10, color: "var(--ink3)", fontFamily: "var(--font-mono-loaded), monospace", letterSpacing: 0.6, margin: "6px 0 14px" }}>ADDED BY NANI · COOKED 8×</div>
          {["Basmati rice", "Chicken thighs", "Yogurt + spices", "Fried onions", "Saffron milk"].map((ing) => (
            <div key={ing} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--forest)" }} />{ing}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebRefine() {
  return (
    <div className="browser-app" style={{ display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" }}>
      <WebSidebar active="Library" />
      <div style={{ flex: 1, padding: "20px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 24, letterSpacing: "-0.02em", marginBottom: 14 }}>Refine with AI</div>
        <div style={{ alignSelf: "flex-end", maxWidth: "62%", background: "var(--forest)", color: "var(--forest-text)", padding: "9px 13px", borderRadius: "14px 14px 4px 14px", fontSize: 12.5, marginBottom: 12 }}>Add more heat and halve the recipe</div>
        <div style={{ maxWidth: "72%", background: "var(--surface)", border: "1px solid var(--border-soft)", padding: "12px 13px", borderRadius: "14px 14px 14px 4px" }}>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono-loaded), monospace", letterSpacing: 1.4, color: "var(--ink3)", marginBottom: 6 }}>SUGGESTED CHANGES</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>+2 green chilies · ½ all quantities · 4 servings → 2</div>
        </div>
      </div>
    </div>
  );
}

function BrowserWindow({ width, height, path, children }: { width: number; height: number; path: string; children: React.ReactNode }) {
  return (
    <div style={{ width, height, borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 34px 70px -30px rgba(20,20,15,0.4), inset 0 0 0 1px rgba(255,255,255,0.04)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 38, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 12px", background: "color-mix(in srgb, var(--paper) 80%, var(--cream))", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (<span key={c} style={{ width: 10, height: 10, borderRadius: 99, background: c }} />))}
        </div>
        <div style={{ flex: 1, maxWidth: 280, margin: "0 auto", height: 22, borderRadius: 7, background: "var(--surface)", border: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "var(--font-mono-loaded), monospace", fontSize: 10.5, color: "var(--ink2)" }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--forest)" }}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>app.eeatly.com</span><span style={{ color: "var(--ink3)" }}>{path}</span>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

const WEB_SCREENS = [
  { key: "kitchen", label: "Kitchen", path: "/kitchen", node: <WebKitchen />, enter: "hp-enter-fade" },
  { key: "recipe", label: "Recipe", path: "/recipe/biryani", node: <WebRecipe />, enter: "hp-enter-lift" },
  { key: "refine", label: "Refine", path: "/refine", node: <WebRefine />, enter: "hp-enter-morph" }
];

function HeroWebDemo() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % WEB_SCREENS.length), 3600);
    return () => clearTimeout(t);
  }, [i, paused]);
  const s = WEB_SCREENS[i];
  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: "relative", zIndex: 1 }}>
        <BrowserWindow width={540} height={368} path={s.path}>
          <div className="hp-stage">
            <div key={s.key} className={`hp-screen ${s.enter} hp-morph-ready`}>{s.node}</div>
          </div>
        </BrowserWindow>
        <div className="callout" style={{ top: -20, left: -28, right: "auto", bottom: "auto", transform: "none", width: 196 }}>
          <div className="callout-head"><span className="callout-icon terra">{mic}</span><span className="callout-kicker">Voice capture</span></div>
          <div className="callout-body">A voice note becomes a recipe — <em>structured</em>, searchable.</div>
        </div>
        <div className="callout" style={{ bottom: -20, right: -28, left: "auto", top: "auto", transform: "none", width: 196 }}>
          <div className="callout-head"><span className="callout-icon forest">{sparkle}</span><span className="callout-kicker">Refine with AI</span></div>
          <div className="callout-body">Change a recipe by <em>asking</em> — “add more heat”.</div>
        </div>
      </div>
      <div className="hero-progress" role="tablist" aria-label="Web app walkthrough">
        {WEB_SCREENS.map((sc, idx) => (
          <button key={sc.key} type="button" className={`hp-dot${idx === i ? " active" : ""}`} onClick={() => setI(idx)} aria-selected={idx === i} role="tab">
            <span className="hp-dot-pip" />
            {sc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Web kitchen dashboard (rendered in the laptop + hero) ────── */
function WebKitchen() {
  const meals = [
    { name: "Nani's Biryani", meta: "Nani · 8×" },
    { name: "Lasagna", meta: "Mara · 5×" },
    { name: "Tacos al pastor", meta: "Diego · 3×" },
    { name: "Shakshuka", meta: "You · 6×" },
    { name: "Dal tadka", meta: "Mom · 12×" },
    { name: "Khichdi", meta: "Nani · 4×" },
    { name: "Ramen", meta: "You · 2×" },
    { name: "Tiramisu", meta: "Mara · 1×" },
    { name: "Pad thai", meta: "Diego · 3×" }
  ];
  return (
    <div className="browser-app" style={{ display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" }}>
      <WebSidebar active="Home" />
      {/* main */}
      <div style={{ flex: 1, padding: "20px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 28, letterSpacing: "-0.02em", lineHeight: 1 }}>Our kitchen</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 5 }}>142 recipes · 4 cooks</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 99, border: "1px solid var(--border-soft)", background: "var(--surface)", color: "var(--ink3)", fontSize: 12 }}>{searchI()} Search dishes</div>
            <div style={{ display: "flex" }}>
              {["F", "M", "D"].map((a, idx) => (
                <span key={a} style={{ width: 26, height: 26, borderRadius: 99, background: MEAL_PALETTES[idx + 1].bg, color: MEAL_PALETTES[idx + 1].fg, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--cream)", marginLeft: idx ? -8 : 0 }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {meals.map((m) => (
            <div key={m.name} style={{ border: "1px solid var(--border-soft)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ aspectRatio: "16 / 10" }}><MealTile name={m.name} fontSize={40} radius={0} /></div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--font-mono-loaded), monospace", letterSpacing: 0.3, marginTop: 2 }}>{m.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Cross-device pair (laptop + phone) ───────────────────────── */
function DevicePair() {
  return (
    <>
      <div className="laptop-wrap">
        <div className="laptop-screen">
          <div className="laptop-camera" />
          <div className="laptop-viewport">
            <div className="browser-chrome">
              <div className="browser-dots"><span className="browser-dot red" /><span className="browser-dot yellow" /><span className="browser-dot green" /></div>
              <div className="browser-url"><span className="url-host">app.eeatly.com</span><span className="url-path">/kitchen</span></div>
            </div>
            <div className="browser-content"><WebKitchen /></div>
          </div>
        </div>
        <div className="laptop-base" />
      </div>
      <div className="device-phone"><IOSDevice width={158} height={336}><RecipeScreen /></IOSDevice></div>
    </>
  );
}

/* ─── Showcase gallery (tabs drive a phone) ────────────────────── */
const GALLERY = [
  { num: "01", label: "Home", screen: <HomeScreen />, eyebrow: "THE LIBRARY", title: "Everything your family cooks", body: "Every recipe in one warm, searchable place — credited to whoever added it.", bullets: ["Hashed-color tiles, no photos needed", "Filter by who, by season, by dish"] },
  { num: "02", label: "Add", screen: <AddScreen />, eyebrow: "CAPTURE", title: "Save it however it arrives", body: "Photo, voice note, or a pasted link. eeatly structures what it can.", bullets: ["Voice → structured recipe", "Photo of handwriting → text"] },
  { num: "03", label: "Recipe", screen: <RecipeScreen />, eyebrow: "THE DISH", title: "The recipe, kept whole", body: "Ingredients, method, and the story of who it came from.", bullets: ["Credited to the family member", "Cook count + last cooked"] },
  { num: "04", label: "Refine", screen: <RefineScreen />, eyebrow: "REFINE", title: "Change it by asking", body: "“Add more heat.” “Half the recipe.” The AI proposes; you decide.", bullets: ["Plain-language edits", "Review before you save"] }
];
function ShowcaseGallery() {
  const [i, setI] = React.useState(0);
  const g = GALLERY[i];
  return (
    <>
      <div className="gallery-tabs" role="tablist" aria-label="Screens">
        {GALLERY.map((t, idx) => (
          <button key={t.num} type="button" className={`gallery-tab${idx === i ? " active" : ""}`} onClick={() => setI(idx)} role="tab" aria-selected={idx === i}>
            <span className="gallery-tab-num">{t.num}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="gallery-stage">
        <div className="gallery-meta">
          <div className="gm-eyebrow">{g.eyebrow}</div>
          <h3>{g.title}</h3>
          <p>{g.body}</p>
        </div>
        <div className="gallery-phone-wrap">
          <div className="gallery-phone-glow" />
          <div className="gallery-phone gallery-fade" key={g.num}><IOSDevice width={300} height={620}>{g.screen}</IOSDevice></div>
        </div>
        <div className="gallery-meta gallery-meta-right">
          <div className="gm-bullets">
            {g.bullets.map((b) => (
              <div className="gm-bullet" key={b}><span className="gm-bullet-dot" />{b}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Theme toggle (next-themes) ───────────────────────────────── */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes mount swap (single transition, intentional)
    setMounted(true);
  }, []);
  const isDark = resolvedTheme === "dark";
  return (
    <button type="button" className="theme-toggle" aria-label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {mounted ? (isDark ? sun : moon) : moon}
    </button>
  );
}

export default function MarketingPage() {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    // Handoff: light is the default for the marketing page. Convert the
    // implicit "system" default to explicit light on first visit; an
    // explicit dark choice (via the toggle) is preserved.
    if (theme === "system") {
      setTheme("light");
    }
  }, [theme, setTheme]);

  return (
    <div className="mkt" id="top">
      {/* Header */}
      <header className="topnav">
        <div className="topnav-inner">
          <Link href="/" className="brand" aria-label="eeatly home"><BrandWordmark size={26} /></Link>
          <div className="topnav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="topnav-actions">
            <Link href={"/sign-in" as Route}>Sign in</Link>
            <Link href={"/sign-up" as Route} className="btn btn-primary">Get started</Link>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-inner">
              <span className="eyebrow">For families who cook from far apart</span>
              <h1>One kitchen.<br />Your whole family.<br />Any distance.</h1>
              <p className="hero-sub">Save the recipes your family actually cooks — from voice notes, WhatsApp photos, recipe links, however they reach you. Everyone in your kitchen can see them, even when you&apos;re not in the same one.</p>
              <div className="hero-ctas">
                <Link className="btn btn-primary" href={"/sign-up" as Route}>Start your kitchen {arrow}</Link>
                <a className="link" href="#pricing">See pricing</a>
              </div>
            </div>
            <div className="mobile-stage">
              <span className="mobile-eyebrow">A walk through the web app</span>
              <div className="phone-slot">
                <div className="phone-slot-glow" />
                <HeroWebDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="trust">
        <div className="trust-row">
          <span className="trust-item">{check} Free to start</span>
          <span className="trust-item">{check} No credit card required</span>
          <span className="trust-item">{check} Your data stays yours</span>
          <span className="trust-item">{check} Private by default</span>
        </div>
        <div className="trust-row">
          <span className="trust-item">Families across 15+ countries</span>
          <span className="trust-item">2,500+ recipes saved</span>
          <span className="trust-item">No recipes lost. Ever.</span>
        </div>
      </div>

      {/* Editorial band */}
      <section className="editorial">
        <div className="wrap">
          <div className="editorial-grid">
            <div>
              <div className="editorial-eyebrow-rule"><span className="editorial-eyebrow">The recipes you love don&apos;t survive</span></div>
              <h2>Good recipes get lost. Always.</h2>
            </div>
            <div className="editorial-body">
              <p>Mom sends the recipe over WhatsApp. You scroll past it. Three months later you want it back, and it&apos;s buried in a chat with four thousand messages.</p>
              <p>Your sister texts you a photo of the spice ratio — your camera roll eats it. You cook something amazing for a holiday dinner, and by next year, you can&apos;t remember exactly what you did.</p>
              <p>Family recipes shouldn&apos;t be this fragile. eeatly keeps them — across phones, across chats, across continents.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-device band */}
      <section className="devices">
        <div className="wrap">
          <span className="section-eyebrow">Works on every device</span>
          <h2 className="section-title">Wherever your family cooks from</h2>
          <p className="section-sub">Open it on your laptop on Sunday, or on your phone&apos;s browser at the stove. Same kitchen, same recipes — your family&apos;s library follows you everywhere, no install needed.</p>
          <div className="device-stage"><DevicePair /></div>
          <div className="device-callouts">
            <div className="device-callout"><div className="dc-icon">{laptopI}</div><div><div className="dc-title">On the web</div><div className="dc-body">Open your kitchen at <span className="dc-mono">app.eeatly.com</span> in any browser — nothing to download.</div></div></div>
            <div className="device-callout"><div className="dc-icon">{phoneI}</div><div><div className="dc-title">On your phone <span className="dc-soon">Coming soon</span></div><div className="dc-body">Works beautifully in your phone&apos;s browser today. Dedicated iOS &amp; Android apps are coming soon.</div></div></div>
            <div className="device-callout"><div className="dc-icon">{globe}</div><div><div className="dc-title">One library</div><div className="dc-body">Sign in once, see the same recipes everywhere — every change syncs in real time.</div></div></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features">
        <div className="wrap">
          <span className="section-eyebrow">What you can do</span>
          <h2 className="section-title">Built around how recipes<br />actually move through families</h2>
          <div className="feat-grid">
            <div className="feat-card feat-card-wide">
              <div className="feat-icon">{camera}</div>
              <h3>Save recipes however they reach you</h3>
              <p>A photo of mom&apos;s handwritten notes. A voice note explaining the method. A recipe link your aunt sent. eeatly reads what we can, and saves the link to the rest so you can find it again.</p>
              <div className="modes">
                <div className="mode-pill">{camera} Photo</div>
                <div className="mode-pill">{mic} Voice</div>
                <div className="mode-pill">{linkI} Link</div>
              </div>
            </div>
            <div className="feat-card feat-card-r1">
              <div className="feat-icon">{users}</div>
              <h3>One kitchen for your whole family</h3>
              <p>Invite mom, your sister, your daughter. Everyone&apos;s recipes in one shared library. Every dish credited to whoever added it.</p>
            </div>
            <div className="feat-card feat-card-tall">
              <div className="feat-icon">{shareIcon}</div>
              <h3>Share a recipe with anyone</h3>
              <p>One link. Works in WhatsApp, text, anywhere. No account needed to view. Revoke the link whenever you want it private again.</p>
            </div>
            <div className="feat-card feat-card-r2">
              <div className="feat-icon">{planIcon}</div>
              <h3>Plan the meals that matter</h3>
              <p>Holiday menus. Birthday dinners. Sunday rotations. Build a plan once, and next year&apos;s plan carries forward last year&apos;s notes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Three steps */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <span className="section-eyebrow">Three steps</span>
          <h2 className="section-title">Cook. Save. Find again.</h2>
          <div className="steps" style={{ marginTop: 56 }}>
            <div className="step"><div className="step-num">1</div><h4>Cook something worth keeping</h4><p>The everyday meal or the once-a-year showstopper.</p></div>
            <div className="step"><div className="step-num">2</div><h4>Save it before you forget</h4><p>Photo, voice note, pasted text, or save a link. Done in under a minute.</p></div>
            <div className="step"><div className="step-num">3</div><h4>Find it when you need it</h4><p>By name, by season, by who added it. Share it when family asks.</p></div>
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section className="showcase">
        <div className="wrap">
          <span className="section-eyebrow">Coming soon</span>
          <h2 className="section-title">A mobile app, in your pocket</h2>
          <p className="section-sub">The eeatly mobile app is on its way. Here&apos;s a preview of the experience — the same kitchen, built for cooking with your phone in hand. Until then, everything works in your phone&apos;s browser.</p>
          <ShowcaseGallery />
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="wrap">
          <span className="section-eyebrow">From real kitchens</span>
          <h2 className="section-title">Stories from families like yours</h2>
          <div className="quotes" style={{ marginTop: 56 }}>
            <div className="quote-card"><p className="quote-body">&ldquo;My mom finally stopped asking me to screenshot her WhatsApp messages. Now she just adds recipes directly and I can actually find them.&rdquo;</p><div className="quote-meta"><div className="quote-name">Fatima K.</div><div className="quote-where">Toronto, Canada</div><div className="quote-where-2">Family kitchen with 4 members</div></div></div>
            <div className="quote-card"><p className="quote-body">&ldquo;We almost lost Nani&apos;s biryani recipe when she passed. Now everything she ever taught us is saved in one place — her voice notes and all.&rdquo;</p><div className="quote-meta"><div className="quote-name">Arjun S.</div><div className="quote-where">London, UK</div><div className="quote-where-2">3 generations sharing recipes</div></div></div>
            <div className="quote-card"><p className="quote-body">&ldquo;I used to have recipes in Notes, photos, bookmarks, and 12 different WhatsApp chats. This finally fixed that chaos.&rdquo;</p><div className="quote-meta"><div className="quote-name">Maryam T.</div><div className="quote-where">Dubai, UAE</div><div className="quote-where-2">Solo cook, 200+ recipes saved</div></div></div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="cta-band">
        <div className="wrap">
          <h2>Your family&apos;s recipes deserve better than a chat archive</h2>
          <p>Start preserving them today. It takes less than a minute to save your first recipe.</p>
          <Link className="btn btn-primary" href={"/sign-up" as Route}>Start your kitchen — it&apos;s free {arrow}</Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing">
        <div className="wrap">
          <div className="pricing-card">
            <span className="section-eyebrow">Pricing</span>
            <h2 className="section-title" style={{ marginBottom: 14 }}>Free for personal use. Plus for the whole family.</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>Log meals, save photos, and search your own kitchen — free, forever. Plus unlocks AI capture, shared family kitchens, and more.</p>
            <div className="pricing-table">
              <table>
                <thead><tr><th>Feature</th><th>Free</th><th>Plus</th></tr></thead>
                <tbody>
                  <tr><td>Save unlimited recipes</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Search your recipes</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Log meals you cook</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>AI capture (voice, photo, video)</td><td className="cross">×</td><td className="check">✓</td></tr>
                  <tr><td>Shared family kitchens</td><td className="cross">×</td><td className="check">✓</td></tr>
                  <tr><td>Occasion &amp; meal planning</td><td className="cross">×</td><td className="check">✓</td></tr>
                  <tr><td>Public share links</td><td className="cross">×</td><td className="check">✓</td></tr>
                </tbody>
              </table>
            </div>
            <div className="pricing-cta">
              <Link className="btn btn-primary" href={"/sign-up" as Route}>Start free {arrow}</Link>
              <Link className="link" href={"/pricing" as Route} style={{ color: "var(--ink2)", textDecoration: "none", fontSize: 14 }}>See full pricing</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <span className="section-eyebrow">Questions</span>
          <h2 className="section-title" style={{ marginBottom: 48 }}>Common questions</h2>
          <div className="faq">
            <details className="faq-item"><summary>Who is eeatly for?</summary><div className="faq-body">Anyone who cooks at home and wants a better place than camera roll, Notes app, or scattered chat threads. We see kitchens across every cuisine — the patterns are universal: recipes get lost, voice notes from a grandparent get buried, the dish someone always brings has no proper home.</div></details>
            <details className="faq-item"><summary>What about family members who aren&apos;t tech-comfortable?</summary><div className="faq-body">They can send you a voice note over WhatsApp and you save it on their behalf, credited to them. Or join with magic-link sign-in: no passwords, just an email.</div></details>
            <details className="faq-item"><summary>What happens to recipes if someone leaves the kitchen?</summary><div className="faq-body">Recipes stay with the kitchen. The person who added them is still credited; their access can be revoked at any time without losing the recipes themselves.</div></details>
            <details className="faq-item"><summary>What is the AI actually doing with my photos and voice notes?</summary><div className="faq-body">It transcribes voice notes, extracts text from photos, and helps structure free-form notes into ingredients and steps. We don&apos;t train on your content, and you can always edit or remove what AI suggested.</div></details>
            <details className="faq-item"><summary>My &ldquo;kitchen&rdquo; is just me. Does eeatly still help?</summary><div className="faq-body">Absolutely. The free tier is built for solo cooks who want their own recipe library that doesn&apos;t live in screenshots and Notes app. Most of our early users started solo.</div></details>
          </div>
          <div className="faq-foot">More questions? <Link href={"/help" as Route}>Visit our help center</Link></div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="foot-inner">
            <div>
              <div className="brand"><BrandWordmark size={28} /></div>
              <p className="foot-tag">Where your family&apos;s recipes live. Across phones, across chats, across continents.</p>
            </div>
            <div className="foot-links">
              <a href="#pricing">Pricing</a>
              <Link href={"/privacy" as Route}>Privacy</Link>
              <Link href={"/help" as Route}>Help</Link>
              <Link href={"/sign-in" as Route}>Sign in</Link>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 eeatly</span>
            <span>Made for families who cook apart</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
