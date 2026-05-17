// eeatly-shell.jsx — shared tokens, icons, primitives

const E_LIGHT = {
  cream: '#F5EFE2',
  creamSoft: '#EFE7D6',
  paper: '#FBF6EA',
  surface: '#FFFFFF',
  ink: '#1A1F1A',
  ink2: '#5F665B',
  ink3: '#9C9787',
  ink4: '#C7C1B0',
  forest: '#2E5739',
  forestDeep: '#1F3D29',
  forestSoft: '#3C6B47',
  forestText: '#F5EFE2',   // text color on forest CTAs
  sage: '#D4DCC5',
  sageDeep: '#BFCBB1',
  sageBg: '#E3E8D5',
  terra: '#C66B47',
  wheat: '#D9C68C',
  border: '#E6DCC4',
  borderSoft: '#EEE5D0',
  danger: '#A8413A',
  dangerSoft: '#F0DBD8',
  scrim: 'rgba(20,20,15,0.32)',
  ctaShadow: '0 6px 20px rgba(31,61,41,0.35)',
  cardShadow: '0 1px 0 rgba(60,40,10,0.02), 0 4px 18px -10px rgba(40,30,10,0.08)',
};

const E_DARK = {
  cream: '#15140F',       // warm near-black bg
  creamSoft: '#1C1A14',
  paper: '#1A1812',
  surface: '#1F1D17',
  ink: '#F0E9D9',
  ink2: '#A8A28F',
  ink3: '#736F5E',
  ink4: '#3A382E',
  forest: '#88B894',      // CTA bg (lighter sage-green so it carries)
  forestDeep: '#6FA37D',
  forestSoft: '#A1CBA9',
  forestText: '#10180F',  // dark text on the light forest CTA
  sage: '#445040',
  sageDeep: '#576550',
  sageBg: '#2A3022',
  terra: '#D88865',
  wheat: '#C9B176',
  border: '#2D2B22',
  borderSoft: '#26241D',
  danger: '#D88078',
  dangerSoft: '#3A211E',
  scrim: 'rgba(0,0,0,0.55)',
  ctaShadow: '0 6px 20px rgba(0,0,0,0.45)',
  cardShadow: '0 1px 0 rgba(0,0,0,0.25), 0 4px 18px -10px rgba(0,0,0,0.5)',
};

// Backward-compat: existing code references `E` directly.
const E = E_LIGHT;

const ThemeCtx = React.createContext(E_LIGHT);
const useT = () => React.useContext(ThemeCtx);

const F = {
  display: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
  body: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

// ─── Icons (24px default, stroke = currentColor) ──────────────
const I = {
  gear: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 14.85a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 005 8.4a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019 8.4v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  home: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" />
    </svg>
  ),
  homeFill: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 10.2L12 3.3l8.6 6.9c.3.2.4.5.4.8V20a1 1 0 01-1 1h-4.5a.5.5 0 01-.5-.5V14a1 1 0 00-1-1h-4a1 1 0 00-1 1v6.5a.5.5 0 01-.5.5H4a1 1 0 01-1-1v-9c0-.3.1-.6.4-.8z" />
    </svg>
  ),
  book: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-2-1.5-4-2-7-2v15c3 0 5 .5 7 2 2-1.5 4-2 7-2V4c-3 0-5 .5-7 2z" />
      <path d="M12 6v15" />
    </svg>
  ),
  bookFill: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 6.4C9.1 5 7.1 4.3 4.5 4.1A1 1 0 003.5 5.1v13.7a1 1 0 001 1c2.4.1 4.1.6 5.8 1.7.4.3.9 0 .9-.5V6.9a.6.6 0 00-.2-.5zM19.5 4.1c-2.6.2-4.6.9-6.5 2.3a.6.6 0 00-.2.5V21c0 .5.5.8.9.5 1.7-1.1 3.4-1.6 5.8-1.7a1 1 0 001-1V5.1a1 1 0 00-1-1z"/>
    </svg>
  ),
  plus: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  plusCircle: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  plusCircleFill: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" stroke={E.cream} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  chevronRight: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevronLeft: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  edit: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  ),
  calendar: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </svg>
  ),
  sparkle: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />
      <path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  ),
  link: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a3.5 3.5 0 005 0l3.5-3.5a3.5 3.5 0 00-5-5l-1 1" />
      <path d="M14 10a3.5 3.5 0 00-5 0l-3.5 3.5a3.5 3.5 0 005 5l1-1" />
    </svg>
  ),
  mic: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </svg>
  ),
  document: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M13 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  camera: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 012-2h2.5L9 4h6l1.5 2H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  image: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </svg>
  ),
  lightbulb: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z" />
    </svg>
  ),
  gauge: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17a8 8 0 1114 0" />
      <path d="M12 17l4-5" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" />
    </svg>
  ),
  userPlus: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c1-3.5 3-5 6-5s5 1.5 6 5" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  ),
  external: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
  ),
  search: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  cutlery: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v8a2 2 0 002 2v8M5 3v5a2 2 0 002 2M11 3v5a2 2 0 01-2 2" />
      <path d="M17 21V3c-2 0-3 2-3 5s1 5 3 5" />
    </svg>
  ),
};

// ─── Hashed palette for meal tiles ────────────────────────────
const MEAL_PALETTES_LIGHT = [
  { bg: '#D7DEC8', fg: '#2E5739', dot: '#A8B79A' },  // sage
  { bg: '#E9D6C2', fg: '#7C3F1F', dot: '#D2A984' },  // terracotta
  { bg: '#E2DDC4', fg: '#665225', dot: '#C8B98B' },  // wheat
  { bg: '#CBD9CF', fg: '#2E4F45', dot: '#9DB1A6' },  // mint
  { bg: '#E5D2CE', fg: '#7A3D3D', dot: '#C9A8A4' },  // rose
  { bg: '#D4D7E0', fg: '#3A4566', dot: '#A9AEC0' },  // indigo
];
const MEAL_PALETTES_DARK = [
  { bg: '#384535', fg: '#C7D5B5', dot: '#52613F' },  // sage
  { bg: '#4A3525', fg: '#E5C09E', dot: '#6B4A30' },  // terracotta
  { bg: '#3D3722', fg: '#D9C68A', dot: '#5C5230' },  // wheat
  { bg: '#2F3F39', fg: '#A8C7BB', dot: '#4A5E55' },  // mint
  { bg: '#3F2D2C', fg: '#D9B4B0', dot: '#5C413F' },  // rose
  { bg: '#2F3548', fg: '#B5BED5', dot: '#454C66' },  // indigo
];

function mealHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function MealTile({ name, size = 'lg', radius = 6 }) {
  const t = useT();
  const palettes = t === E_DARK ? MEAL_PALETTES_DARK : MEAL_PALETTES_LIGHT;
  const p = palettes[mealHash(name) % palettes.length];
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const fs = { xl: 124, lg: 96, md: 64, sm: 40 }[size] || 96;
  return (
    <div style={{
      width: '100%', height: '100%', background: p.bg, color: p.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', borderRadius: radius,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, ${p.dot}55 1px, transparent 1.4px)`,
        backgroundSize: '14px 14px', backgroundPosition: '0 0',
        opacity: 0.55,
      }} />
      <span style={{
        fontFamily: F.display, fontSize: fs, fontStyle: 'italic',
        lineHeight: 0.9, letterSpacing: '-0.04em',
        position: 'relative', zIndex: 1, marginTop: '-0.08em',
      }}>{letter}</span>
      {/* hairline cookbook frame */}
      <div style={{
        position: 'absolute', inset: 6, borderRadius: radius - 2,
        border: `1px solid ${p.dot}66`, pointerEvents: 'none',
      }} />
    </div>
  );
}

// ─── Status bar pad (visual gap below dynamic island) ─────────
function StatusPad() {
  return <div style={{ height: 54 }} />;
}

// ─── Top nav: small title in middle, optional left/right ──────
function NavBar({ title, left, right, divider = true, bg }) {
  const E = useT();
  return (
    <div style={{ background: bg || E.cream, position: 'sticky', top: 0, zIndex: 5 }}>
      <StatusPad />
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 16, display: 'flex', alignItems: 'center', color: E.forest }}>{left}</div>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: F.body, fontWeight: 600, fontSize: 16, letterSpacing: -0.1, color: E.ink }}>{title}</div>
        <div style={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', color: E.forest }}>{right}</div>
      </div>
      {divider && <div style={{ height: 1, background: E.border, opacity: 0.7 }} />}
    </div>
  );
}

// ─── Bottom tab bar ───────────────────────────────────────────
function TabBar({ active = 'home', bg }) {
  const E = useT();
  const tabs = [
    { id: 'home', label: 'Home', icon: I.home, iconActive: I.homeFill },
    { id: 'add', label: 'Add', icon: I.plusCircle, iconActive: I.plusCircleFill },
    { id: 'library', label: 'Library', icon: I.book, iconActive: I.bookFill },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 30, paddingTop: 10, paddingLeft: 8, paddingRight: 8,
      background: bg || E.cream, borderTop: `1px solid ${E.border}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <div key={t.id} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4,
            color: on ? E.forest : E.ink3,
          }}>
            <div style={{
              padding: '4px 14px', borderRadius: 99,
              background: on ? E.sageBg : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{on ? t.iconActive(22) : t.icon(22)}</div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: 0.2 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Phone shell (uses IOSDevice for bezel + status + indicator)
function Phone({ children, dark = false, bg }) {
  const theme = dark ? E_DARK : E_LIGHT;
  return (
    <ThemeCtx.Provider value={theme}>
      <IOSDevice width={393} height={852} dark={dark}>
        <div style={{
          height: '100%', background: bg || theme.cream, color: theme.ink,
          fontFamily: F.body, fontSize: 15, WebkitFontSmoothing: 'antialiased',
          position: 'relative', display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </div>
      </IOSDevice>
    </ThemeCtx.Provider>
  );
}

// ─── Scrollable content area that leaves room for the tab bar ─
function Content({ children, pad = 20 }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: `8px ${pad}px 110px` }}>
      {children}
    </div>
  );
}

// ─── Small chip / badge ───────────────────────────────────────
function Chip({ children, icon, tone = 'sage' }) {
  const E = useT();
  const isDark = E === E_DARK;
  const tones = {
    sage:   { bg: E.sageBg, fg: isDark ? E.forestSoft : E.forest, border: 'transparent' },
    wheat:  { bg: isDark ? '#3A3320' : '#EDDFB7', fg: isDark ? '#D9C68A' : '#6F571E', border: 'transparent' },
    terra:  { bg: isDark ? '#3D2722' : '#EFD5C9', fg: isDark ? '#E5A488' : '#7A3A1B', border: 'transparent' },
    ghost:  { bg: 'transparent', fg: E.ink2, border: E.border },
  };
  const t = tones[tone] || tones.sage;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px 5px 10px', borderRadius: 99,
      background: t.bg, color: t.fg,
      border: `1px solid ${t.border}`,
      fontSize: 12.5, fontWeight: 600, letterSpacing: 0.1,
      fontFamily: F.body, whiteSpace: 'nowrap',
    }}>
      {icon}{children}
    </span>
  );
}

// ─── Round icon plaque ────────────────────────────────────────
function IconBubble({ children, size = 44, bg, fg }) {
  const E = useT();
  bg = bg || E.sageBg;
  fg = fg || (E === E_DARK ? E.forestSoft : E.forest);
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{children}</div>
  );
}

// ─── A simple card shell ──────────────────────────────────────
function Card({ children, padding = 16, style = {} }) {
  const E = useT();
  return (
    <div style={{
      background: E.surface, borderRadius: 14,
      border: `1px solid ${E.borderSoft}`,
      boxShadow: E.cardShadow,
      padding,
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  E, E_LIGHT, E_DARK, F, I, MealTile, NavBar, TabBar, Phone, Content,
  Chip, IconBubble, Card, ThemeCtx, useT,
});
