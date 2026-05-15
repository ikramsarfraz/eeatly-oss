import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 17 — section header.
 *
 * One line: title (heading-3) on the left, optional trailing action
 * (typically a Link or ghost Button) on the right. Vertical padding
 * 16px so sections breathe.
 *
 * Skip `action` when the section doesn't have a navigable "see all"
 * destination — most don't.
 */
type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 pt-6 pb-3 ${className ?? ""}`}
    >
      <Text className="text-heading-3 font-semibold text-foreground">
        {title}
      </Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
