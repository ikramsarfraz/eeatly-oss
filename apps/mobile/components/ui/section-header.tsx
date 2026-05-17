import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — legacy section header retained for screens not yet
 * migrated to `<SectionLabel>`. New code should prefer
 * `<SectionLabel>`, which renders the editorial uppercase eyebrow
 * style. This component remains a thin shim for backwards compat.
 */
type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <View
      className={`flex-row items-baseline justify-between px-5 pt-6 pb-3 ${className ?? ""}`}
    >
      <Text
        className="font-body-semibold text-label uppercase text-ink-2 dark:text-ink-2-dark"
        style={{ letterSpacing: 1.4 }}
      >
        {title.toUpperCase()}
      </Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
