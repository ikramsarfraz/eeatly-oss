import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — small uppercase eyebrow label that introduces a section.
 *
 * Replaces the heavy heading-3 "SectionHeader" from R17. The editorial
 * design uses these as quiet section markers (RECENTLY COOKED, MOST
 * COOKED, DISHES) rather than full headings, so the serif page title
 * stays the visual anchor.
 *
 * `action` slot renders right-aligned, typically a "View all" link in
 * forest green.
 */
type SectionLabelProps = {
  children: string;
  action?: ReactNode;
  className?: string;
};

export function SectionLabel({ children, action, className }: SectionLabelProps) {
  return (
    <View
      className={`flex-row items-baseline justify-between mb-3 mt-1 ${className ?? ""}`}
    >
      <Text
        className="font-body-semibold text-label uppercase text-ink-2"
        style={{ letterSpacing: 1.4 }}
      >
        {children}
      </Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
