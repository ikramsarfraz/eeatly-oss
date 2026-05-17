/**
 * Round 18/19 — design token constants.
 *
 * NativeWind covers most of the styling, but some primitives (icons,
 * ActivityIndicator, status bar, native nav header) accept color
 * values as strings and can't read Tailwind tokens. Centralising the
 * raw hex values here keeps those callsites in sync with the
 * tailwind.config.js — change a hex in one place, update both.
 *
 * `colors` is the LIGHT-mode palette. `colorsDark` mirrors it for the
 * R19 dark-mode pass. Callers that can use NativeWind classes should
 * prefer `bg-cream dark:bg-cream-dark` instead of touching these
 * objects — these are for inline-style consumers (dynamic colors fed
 * into `style={{ color: ... }}`, RN icon `color` props, etc.).
 */
export type ThemeColors = {
  cream: string;
  creamSoft: string;
  paper: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  forest: string;
  forestDeep: string;
  forestSoft: string;
  forestText: string;
  sage: string;
  sageDeep: string;
  sageBg: string;
  terra: string;
  wheat: string;
  border: string;
  borderSoft: string;
  danger: string;
  dangerSoft: string;
};

export const colors: ThemeColors = {
  cream: "#F5EFE2",
  creamSoft: "#EFE7D6",
  paper: "#FBF6EA",
  surface: "#FFFFFF",
  ink: "#1A1F1A",
  ink2: "#5F665B",
  ink3: "#9C9787",
  ink4: "#C7C1B0",
  forest: "#2E5739",
  forestDeep: "#1F3D29",
  forestSoft: "#3C6B47",
  forestText: "#F5EFE2",
  sage: "#D4DCC5",
  sageDeep: "#BFCBB1",
  sageBg: "#E3E8D5",
  terra: "#C66B47",
  wheat: "#D9C68C",
  border: "#E6DCC4",
  borderSoft: "#EEE5D0",
  danger: "#A8413A",
  dangerSoft: "#F0DBD8"
};

/** Round 19 — dark-mode palette mirror. Same semantic keys, retuned
 *  for a warm near-black ground. Forest greens INVERT to a lighter
 *  sage-green so the primary CTA still pops against the dark surface;
 *  `forestText` is dark in dark mode (text on the inverted CTA). */
export const colorsDark: ThemeColors = {
  cream: "#15140F",
  creamSoft: "#1C1A14",
  paper: "#1A1812",
  surface: "#1F1D17",
  ink: "#F0E9D9",
  ink2: "#A8A28F",
  ink3: "#736F5E",
  ink4: "#3A382E",
  forest: "#88B894",
  forestDeep: "#6FA37D",
  forestSoft: "#A1CBA9",
  forestText: "#10180F",
  sage: "#445040",
  sageDeep: "#576550",
  sageBg: "#2A3022",
  terra: "#D88865",
  wheat: "#C9B176",
  border: "#2D2B22",
  borderSoft: "#26241D",
  danger: "#D88078",
  dangerSoft: "#3A211E"
};

export const fonts = {
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  body: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodySemibold: "Geist_600SemiBold",
  bodyBold: "Geist_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoSemibold: "JetBrainsMono_600SemiBold"
} as const;

/**
 * Six-palette hashed lookup used by MealTile. The same dish name
 * deterministically picks the same palette across every screen, which
 * is the wife-test signal that the app remembers her cooking.
 *
 * Palettes mirror the handoff exactly (bg / fg / dotted-texture).
 */
export const mealTilePalettes = [
  { bg: "#D7DEC8", fg: "#2E5739", dot: "#A8B79A" }, // sage
  { bg: "#E9D6C2", fg: "#7C3F1F", dot: "#D2A984" }, // terracotta
  { bg: "#E2DDC4", fg: "#665225", dot: "#C8B98B" }, // wheat
  { bg: "#CBD9CF", fg: "#2E4F45", dot: "#9DB1A6" }, // mint
  { bg: "#E5D2CE", fg: "#7A3D3D", dot: "#C9A8A4" }, // rose
  { bg: "#D4D7E0", fg: "#3A4566", dot: "#A9AEC0" } // indigo
] as const;

export function mealHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function mealPalette(name: string) {
  return mealTilePalettes[mealHash(name) % mealTilePalettes.length];
}
