import { useColorScheme } from "react-native";
import { colors, colorsDark, type ThemeColors } from "./tokens";

/**
 * Round 19 — theme-aware color lookup for inline `style={{}}` consumers
 * + RN APIs that take hex strings directly (icons, ActivityIndicator,
 * StatusBar tint, etc.).
 *
 * NativeWind class consumers should prefer the `dark:` variant prefix
 * directly (`bg-cream dark:bg-cream-dark`); this hook is the escape
 * hatch for when class strings aren't enough.
 *
 * Reads from `useColorScheme()` (RN built-in) which mirrors the system
 * appearance setting — assumes app.json's `userInterfaceStyle` is
 * `"automatic"`. A null return from the hook (rare; happens during
 * the first paint on some devices) falls through to light, matching
 * what NativeWind does in the same edge case.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? colorsDark : colors;
}

/** Returns `true` when the system is in dark mode. Use for branching
 *  decisions that aren't a simple color swap (e.g. picking between two
 *  different SVG illustrations, choosing a CTA shadow opacity, …). */
export function useIsDark(): boolean {
  const scheme = useColorScheme();
  return scheme === "dark";
}
