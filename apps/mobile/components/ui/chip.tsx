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

const toneClasses: Record<
  ChipTone,
  { container: string; text: string }
> = {
  sage: {
    container: "bg-sage-bg",
    text: "text-forest"
  },
  wheat: {
    container: "bg-[#EDDFB7]",
    text: "text-[#6F571E]"
  },
  terra: {
    container: "bg-[#EFD5C9]",
    text: "text-[#7A3A1B]"
  },
  ghost: {
    container: "bg-transparent border border-border",
    text: "text-ink-2"
  },
  danger: {
    container: "bg-danger-soft",
    text: "text-danger"
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
