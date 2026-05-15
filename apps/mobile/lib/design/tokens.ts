/**
 * Round 18 — design token constants.
 *
 * NativeWind covers most of the styling, but some primitives (icons,
 * ActivityIndicator, status bar, native nav header) accept color
 * values as strings and can't read Tailwind tokens. Centralising the
 * raw hex values here keeps those callsites in sync with the
 * tailwind.config.js — change a hex in one place, update both.
 *
 * Light theme only for now; the dark-mode pass (see handoff) is a
 * future round.
 */
export const colors = {
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
} as const;

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
