import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 17 — empty state.
 *
 * Centered icon-in-circle + title + body + optional action. Use on
 * every list-bearing screen when the underlying collection is
 * genuinely empty (not just loading or filtered — those have their
 * own affordances).
 *
 * The icon container is `primary-muted` so the icon glyph itself
 * can stay in `primary` for color contrast.
 */
type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-muted">
        {icon}
      </View>
      <Text className="text-heading-2 font-semibold text-foreground text-center">
        {title}
      </Text>
      {body ? (
        <Text className="text-body text-foreground-muted text-center max-w-[280px]">
          {body}
        </Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
