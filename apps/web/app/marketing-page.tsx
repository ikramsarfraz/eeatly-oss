"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import type { TierDisplayMap } from "@/lib/pricing";
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
// Small sidebar icons (match the real app's lucide set).
const navIcon = {
  home: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" /></svg>,
  cal: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>,
  book: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 012-2h13v17H6a2 2 0 00-2 2V5z" /><path d="M6 18h13" /></svg>,
  plus: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  spark: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" /></svg>,
  users: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M21 21v-2a4 4 0 00-3-3.87M17 3.13a4 4 0 010 7.75" /></svg>,
  gear: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" /></svg>
};

function WebSidebar({ active }: { active: string }) {
  const groups: Array<{ label: string; items: Array<[string, React.ReactNode]> }> = [
    { label: "Cook", items: [["Home", navIcon.home], ["Plans", navIcon.cal], ["Library", navIcon.book]] },
    { label: "Capture", items: [["Add a meal", navIcon.plus], ["Capture with AI", navIcon.spark]] },
    { label: "Kitchen", items: [["Members", navIcon.users], ["Settings", navIcon.gear]] }
  ];
  return (
    <div style={{ width: 176, flexShrink: 0, borderRight: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--paper) 55%, var(--cream))", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 13, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 2 }}>
        <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "var(--forest)", color: "var(--forest-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontStyle: "italic", fontSize: 21, lineHeight: 0.78 }}>e</span>
        <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 20, letterSpacing: "-0.01em", lineHeight: 1 }}>eeatly</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 9, background: "var(--ink)", color: "var(--cream)", fontSize: 12.5, fontWeight: 600 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Log a meal
      </div>
      {groups.map((g) => (
        <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontFamily: "var(--font-mono-loaded), monospace", fontSize: 8.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--ink3)", padding: "2px 9px 4px" }}>{g.label}</div>
          {g.items.map(([label, ic]) => {
            const on = label === active;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 600 : 500, color: on ? "var(--forest)" : "var(--ink2)", background: on ? "var(--sage-bg)" : "transparent" }}>
                <span style={{ display: "inline-flex", width: 15, height: 15 }}>{ic}</span>{label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const monoLabel: React.CSSProperties = { fontFamily: "var(--font-mono-loaded), monospace", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--ink3)" };
const chipSage: React.CSSProperties = { padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "var(--sage-bg)", color: "var(--forest)" };
const chipWheat: React.CSSProperties = { padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "color-mix(in srgb, var(--wheat) 38%, transparent)", color: "color-mix(in srgb, var(--wheat) 30%, var(--ink))" };
const chipGhost: React.CSSProperties = { padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", color: "var(--ink2)" };

// Recipe Detail — mirrors the real editorial recipe page: square monogram
// tile + split title + chip row + meta + Refine/Log actions, over an
// ingredient sidebar + method column.
function WebRecipe() {
  return (
    <div className="browser-app" style={{ display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" }}>
      <WebSidebar active="Library" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 192, height: 192, flexShrink: 0 }}><MealTile name="Nani's Chicken Biryani" fontSize={100} radius={0} /></div>
          <div style={{ flex: 1, padding: "18px 22px", minWidth: 0 }}>
            <div style={monoLabel}>Recipe · in library</div>
            <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontStyle: "italic", fontSize: 18, color: "var(--ink2)", lineHeight: 1, marginTop: 9 }}>Nani&apos;s Chicken,</div>
            <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 44, letterSpacing: "-0.025em", lineHeight: 0.92, color: "var(--ink)" }}>Biryani.</div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <span style={chipSage}>Easy</span>
              <span style={chipGhost}>9 ingredients</span>
              <span style={chipWheat}>4 steps</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 11 }}>Added by Nani · 8 cooks · 2 days ago</div>
            <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 99, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{sparkle} Refine with AI</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 99, background: "var(--forest)", color: "var(--forest-text)", fontSize: 12, fontWeight: 600 }}>Log a cook</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: 234, flexShrink: 0, background: "var(--cream-soft)", borderRight: "1px solid var(--border-soft)", padding: "16px 18px", overflow: "hidden" }}>
            <div style={{ ...monoLabel, marginBottom: 10 }}>Ingredients</div>
            {[["Basmati rice", "2 cups"], ["Chicken thighs", "700 g"], ["Yogurt", "¾ cup"], ["Fried onions", "1 cup"], ["Saffron milk", "3 tbsp"]].map(([n, q]) => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <span>{n}</span><span style={{ fontFamily: "var(--font-mono-loaded), monospace", fontSize: 10.5, color: "var(--ink3)" }}>{q}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: "16px 20px", overflow: "hidden" }}>
            <div style={{ ...monoLabel, marginBottom: 12 }}>Method</div>
            <div style={{ display: "flex", gap: 13 }}>
              <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontStyle: "italic", fontSize: 26, color: "var(--forest)", lineHeight: 1 }}>1</div>
              <div>
                <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 17, color: "var(--ink)" }}>Marinate the chicken</div>
                <div style={{ fontFamily: "var(--font-mono-loaded), monospace", fontSize: 10, color: "var(--ink3)", letterSpacing: 0.5, margin: "3px 0 7px" }}>30 MIN · OVERNIGHT BEST</div>
                <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.5 }}>Whisk the yogurt with the spice mix, coat the thighs, and rest covered.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrowserWindow({ width, height, path, children }: { width: number | string; height: number; path: string; children: React.ReactNode }) {
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
  { key: "kitchen", label: "Home", path: "/home", node: <WebHome />, enter: "hp-enter-fade" },
  { key: "recipe", label: "Recipe", path: "/library/chowmein-noodles", node: <WebRecipe />, enter: "hp-enter-lift" }
];

function HeroWebDemo() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % WEB_SCREENS.length), 8000);
    return () => clearTimeout(t);
  }, [i, paused]);
  const s = WEB_SCREENS[i];
  return (
    <div className="hero-demo-wrap">
      <span className="mobile-eyebrow">eeatly on the web</span>
      <div className="hero-demo-frame" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="hero-demo-glow" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <BrowserWindow width="100%" height={540} path={s.path}>
            <div className="hp-stage">
              <div key={s.key} className={`hp-screen ${s.enter} hp-morph-ready`}>{s.node}</div>
            </div>
          </BrowserWindow>
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
// Home — mirrors the real dashboard: editorial hero (kicker + first name
// + date + week summary), 4-up stat cards, and a "Recently cooked" row.
function WebHome() {
  const recents = [
    { name: "Chowmein Noodles", date: "4D AGO" },
    { name: "Margherita Pizza", date: "6D AGO" },
    { name: "Shakshuka", date: "9D AGO" },
    { name: "Pad Thai", date: "12D AGO" },
    { name: "Beef Tacos", date: "2W AGO" }
  ];
  const stats: Array<[string, string, "sage" | "wheat"]> = [
    ["Logged this week", "3", "sage"],
    ["In library", "142", "wheat"],
    ["Reliable repeats", "18", "sage"],
    ["Pending invites", "2", "wheat"]
  ];
  return (
    <div className="browser-app" style={{ display: "flex", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "var(--ink)" }}>
      <WebSidebar active="Home" />
      <div style={{ flex: 1, padding: "22px 26px", overflow: "hidden" }}>
        <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontStyle: "italic", fontSize: 18, color: "var(--ink2)", lineHeight: 1 }}>Good evening,</div>
        <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 52, letterSpacing: "-0.02em", lineHeight: 0.95, color: "var(--ink)", marginTop: 4 }}>Sara.</div>
        <div style={{ ...monoLabel, marginTop: 8 }}>Fri, May 30</div>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 8, maxWidth: 520 }}>You&apos;ve cooked <strong style={{ color: "var(--ink)" }}>3</strong> meals this week. Next up: <em style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", color: "var(--ink)" }}>Eid dinner</em>.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 11, marginTop: 18 }}>
          {stats.map(([label, val, tone]) => (
            <div key={label} style={{ borderRadius: 12, padding: "12px 13px", background: tone === "sage" ? "var(--sage-bg)" : "color-mix(in srgb, var(--wheat) 32%, transparent)", border: `1px solid ${tone === "sage" ? "color-mix(in srgb, var(--sage) 70%, transparent)" : "color-mix(in srgb, var(--wheat) 55%, transparent)"}` }}>
              <div style={monoLabel}>{label}</div>
              <div style={{ fontFamily: "var(--font-serif-loaded), 'Instrument Serif', serif", fontSize: 34, lineHeight: 1, color: "var(--ink)", marginTop: 6, letterSpacing: "-0.02em" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "20px 0 10px" }}>
          <div style={monoLabel}>Recently cooked</div>
          <span style={{ fontSize: 11, color: "var(--ink2)" }}>See all →</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 11 }}>
          {recents.map((r) => (
            <div key={r.name}>
              <div style={{ aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-soft)" }}><MealTile name={r.name} fontSize={38} radius={0} /></div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ ...monoLabel, fontSize: 8.5, marginTop: 2 }}>{r.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
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

export default function MarketingPage({ prices }: { prices: TierDisplayMap }) {
  return (
    <div className="mkt" id="top">
      {/* Header — shared marketing chrome (landing variant uses in-page anchors). */}
      <SiteHeader variant="landing" />

      {/* Hero */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-lead">
            <span className="eyebrow">For families who cook from far apart</span>
            <h1>One kitchen.<br />Your whole family.<br />Any distance.</h1>
            <p className="hero-sub">Save the recipes your family actually cooks — from voice notes, WhatsApp photos, recipe links, however they reach you. Everyone in your kitchen can see them, even when you&apos;re not in the same one.</p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href={"/sign-up" as Route}>Start your kitchen {arrow}</Link>
              <a className="link" href="#pricing">See pricing</a>
            </div>
            <span className="hero-note">
              <span className="hero-note-pill">On the web</span>
              <span>
                Use eeatly free in any browser today.{" "}
                <strong>The iPhone app is coming soon.</strong>
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Web app walkthrough — full-width band under the hero */}
      <section className="hero-demo">
        <HeroWebDemo />
      </section>

      {/* Trust strip */}
      <div className="trust">
        <div className="trust-row">
          <span className="trust-item">{check} Free to start</span>
          <span className="trust-item">{check} No credit card required</span>
          <span className="trust-item">{check} Your data stays yours</span>
          <span className="trust-item">{check} Private by default</span>
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
          <h2 className="section-title">An eeatly app for your iPhone</h2>
          <p className="section-sub">eeatly works in any browser today. We&apos;re building a native iPhone app for capturing recipes the moment they arrive and cooking with your phone in hand — here&apos;s a preview of what&apos;s on the way.</p>
          <ShowcaseGallery />
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
            <h2 className="section-title" style={{ marginBottom: 14 }}>Free to start. Chef to share. Head Chef for more AI. Master Chef to collaborate.</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>Log meals, save photos, search your kitchen, and capture recipes with AI — free, forever (within a monthly credit grant). Chef adds shared family kitchens, meal planning, and public links; Head Chef adds priority AI and more credits; Master Chef adds co-editing and shareable plans.</p>
            <div className="pricing-table">
              <table>
                <thead><tr><th>Feature</th><th>Cook</th><th>Chef</th><th>Head Chef</th><th>Master Chef</th></tr></thead>
                <tbody>
                  <tr><td>Price / month</td><td className="tier-num">{prices.free.monthly}</td><td className="tier-num">{prices.plus.monthly}</td><td className="tier-num">{prices.premium.monthly}</td><td className="tier-num">{prices.pro.monthly}</td></tr>
                  <tr><td>Save unlimited recipes</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Search your recipes</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Log meals you cook</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>AI capture (photo, text, voice)</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Shared family kitchens</td><td className="cross">×</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Occasion &amp; meal planning</td><td className="cross">×</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Public recipe share links</td><td className="cross">×</td><td className="check">✓</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Priority AI — no burst limits</td><td className="cross">×</td><td className="cross">×</td><td className="check">✓</td><td className="check">✓</td></tr>
                  <tr><td>Co-editing — family edits your recipes &amp; plans</td><td className="cross">×</td><td className="cross">×</td><td className="cross">×</td><td className="check">✓</td></tr>
                  <tr><td>Shareable meal plans (public plan pages)</td><td className="cross">×</td><td className="cross">×</td><td className="cross">×</td><td className="check">✓</td></tr>
                  <tr><td>AI credits / month</td><td className="tier-num">{prices.free.credits.toLocaleString()}</td><td className="tier-num">{prices.plus.credits.toLocaleString()}</td><td className="tier-num">{prices.premium.credits.toLocaleString()}</td><td className="tier-num">{prices.pro.credits.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="pricing-cta">
              <Link className="btn btn-primary" href={"/sign-up" as Route}>Try eeatly {arrow}</Link>
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
            <details className="faq-item"><summary>Who is eeatly for?</summary><div className="faq-body">Anyone who cooks at home and wants a better place than camera roll, Notes app, or scattered chat threads. It&apos;s built for every cuisine — the patterns are universal: recipes get lost, voice notes from a grandparent get buried, the dish someone always brings has no proper home.</div></details>
            <details className="faq-item"><summary>What about family members who aren&apos;t tech-comfortable?</summary><div className="faq-body">They can send you a voice note over WhatsApp and you save it on their behalf, credited to them. Or join with magic-link sign-in: no passwords, just an email.</div></details>
            <details className="faq-item"><summary>What happens to recipes if someone leaves the kitchen?</summary><div className="faq-body">Recipes stay with the kitchen. The person who added them is still credited; their access can be revoked at any time without losing the recipes themselves.</div></details>
            <details className="faq-item"><summary>What is the AI actually doing with my photos and voice notes?</summary><div className="faq-body">It transcribes voice notes, extracts text from photos, and helps structure free-form notes into ingredients and steps. We don&apos;t train on your content, and you can always edit or remove what AI suggested.</div></details>
            <details className="faq-item"><summary>My &ldquo;kitchen&rdquo; is just me. Does eeatly still help?</summary><div className="faq-body">Absolutely. The free tier is built for solo cooks who want their own recipe library that doesn&apos;t live in screenshots and Notes app.</div></details>
          </div>
          <div className="faq-foot">More questions? <Link href={"/help" as Route}>Visit our help center</Link></div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
