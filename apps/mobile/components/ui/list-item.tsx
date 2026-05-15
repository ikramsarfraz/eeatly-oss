import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 18 — grouped-list row, used inside Settings / Kitchen Card
 * containers. Layout: optional leading slot → title + optional
 * subtitle stack → optional trailing slot (chevron, badge, value).
 *
 * `value` renders right-aligned in mono — used for "alex.rivers" /
 * email values on the settings rows.
 *
 * `divider` (default true) draws a soft hairline at the bottom; pass
 * `false` for the last row of a group to avoid stacked dividers.
 */
type ListItemProps = {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
};

export function ListItem({
  title,
  subtitle,
  value,
  leading,
  trailing,
  onPress,
  divider = true,
  destructive
}: ListItemProps) {
  const titleColor = destructive ? "text-danger" : "text-ink";
  const inner = (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 min-h-[56px] ${
        divider ? "border-t border-border-soft" : ""
      }`}
    >
      {leading ? <View>{leading}</View> : null}
      <View className="flex-1 gap-0.5">
        <Text
          className={`font-body-semibold text-body-lg ${titleColor}`}
          style={{ letterSpacing: -0.1 }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="font-body text-body-md text-ink-2"
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          className="font-mono text-chip text-ink-2"
          style={{ letterSpacing: 0.2 }}
        >
          {value}
        </Text>
      ) : null}
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );

  if (!onPress) {
    return inner;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      className="active:bg-sage-bg/40"
    >
      {inner}
    </Pressable>
  );
}
