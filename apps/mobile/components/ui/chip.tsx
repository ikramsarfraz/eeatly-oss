import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — small pill badge.
 *
 * Tones:
 *   - `sage`  — soft green pill on sage-bg with forest text. Default,
 *               used for "Owner", effort summaries, etc.
 *   - `wheat` — warm yellow pill. Reserved for accent metadata.
 *   - `terra` — terracotta pill. Reserved.
 *   - `ghost` — transparent with thin border. Used for "Free" plan
 *               badge and other neutral indicators.
 *
 * The `icon` slot renders inline left of the label — used by the
 * gauge icon on plan-detail's "2 dishes · medium" chip.
 */
export type ChipTone = "sage" | "wheat" | "terra" | "ghost" | "danger";

type ChipProps = {
  children: string;
  tone?: ChipTone;
  icon?: ReactNode;
};

// Tone palettes carry both light + dark variants. NativeWind picks the
// right side via the `dark:` prefix when `useColorScheme()` returns
// "dark" — see tailwind.config.js `darkMode: 'media'`.
const toneClasses: Record<
  ChipTone,
  { container: string; text: string }
> = {
  sage: {
    container: "bg-sage-bg dark:bg-sage-bg-dark",
    text: "text-forest dark:text-forest-soft-dark"
  },
  wheat: {
    container: "bg-[#EDDFB7] dark:bg-[#3A2F18]",
    text: "text-[#6F571E] dark:text-wheat-dark"
  },
  terra: {
    container: "bg-[#EFD5C9] dark:bg-[#3A2A20]",
    text: "text-[#7A3A1B] dark:text-terra-dark"
  },
  ghost: {
    container:
      "bg-transparent border border-border dark:border-border-dark",
    text: "text-ink-2 dark:text-ink-2-dark"
  },
  danger: {
    container: "bg-danger-soft dark:bg-danger-soft-dark",
    text: "text-danger dark:text-danger-dark"
  }
};

export function Chip({ children, tone = "sage", icon }: ChipProps) {
  const t = toneClasses[tone];
  return (
    <View
      className={`self-start flex-row items-center rounded-pill px-3 py-1.5 ${t.container}`}
    >
      {icon ? <View className="mr-1.5">{icon}</View> : null}
      <Text
        className={`font-body-semibold text-chip ${t.text}`}
        style={{ letterSpacing: -0.1 }}
      >
        {children}
      </Text>
    </View>
  );
}
