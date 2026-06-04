import { Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — empty state. Centered icon-in-bubble + serif italic
 * kicker (optional) + serif title + body + optional action.
 *
 * The italic kicker matches the editorial "One plan so far." pattern
 * on the plans list — pass it via `kicker` for the same treatment.
 */
type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body?: string;
  kicker?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  body,
  kicker,
  action
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-sage-bg dark:bg-sage-bg-dark">
        {icon}
      </View>
      {kicker ? (
        <Text className="font-display-italic text-kicker text-ink-2 dark:text-ink-2-dark">
          {kicker}
        </Text>
      ) : null}
      <Text
        className="font-display text-display-xs text-ink dark:text-ink-dark text-center"
        style={{ letterSpacing: -0.4 }}
      >
        {title}
      </Text>
      {body ? (
        <Text className="font-body text-body-lg text-ink-2 dark:text-ink-2-dark text-center max-w-[280px]">
          {body}
        </Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
