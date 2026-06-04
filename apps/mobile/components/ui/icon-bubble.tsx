import { View } from "react-native";
import type { ReactNode } from "react";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 18/19 — round icon plaque used in row cards (plans, add hub,
 * settings rows). Sage-bg by default, forest icon — matches the design
 * system's "softly highlighted" affordance.
 *
 * Override `bg` for primary CTA cards where the bubble sits on a
 * forest surface (we use 12% cream for the bg there).
 *
 * R19: dark-mode aware. The default sage-bg picks the dark variant
 * automatically via `useThemeColors()`. Callers passing an explicit
 * `bg` opt out — they're responsible for choosing a value that works
 * in both modes.
 */
type IconBubbleProps = {
  children: ReactNode;
  size?: number;
  bg?: string;
  /** Convenience prop — when true, render a translucent cream bubble
   * suitable for the forest CTA card. */
  onPrimary?: boolean;
};

export function IconBubble({
  children,
  size = 44,
  bg,
  onPrimary
}: IconBubbleProps) {
  const colors = useThemeColors();
  const background =
    bg ?? (onPrimary ? "rgba(245,239,226,0.18)" : colors.sageBg);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}
