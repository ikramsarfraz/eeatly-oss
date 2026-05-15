import { View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — round icon plaque used in row cards (plans, add hub,
 * settings rows). Sage-bg by default, forest icon — matches the design
 * system's "softly highlighted" affordance.
 *
 * Override `bg` / `fg` for primary CTA cards where the bubble sits on
 * a forest surface (we use 12% white for the bg there).
 */
type IconBubbleProps = {
  children: ReactNode;
  size?: number;
  bg?: string;
  /** Convenience prop — when true, render a translucent white bubble
   * suitable for the forest CTA card. */
  onPrimary?: boolean;
};

export function IconBubble({
  children,
  size = 44,
  bg,
  onPrimary
}: IconBubbleProps) {
  const background =
    bg ?? (onPrimary ? "rgba(245,239,226,0.18)" : "#E3E8D5");
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
