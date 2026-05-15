import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 17 — list row. Use inside grouped lists or as standalone rows.
 *
 * Layout: optional leading slot (icon, avatar, photo thumbnail) →
 * title + subtitle stack → optional trailing slot (chevron, badge,
 * timestamp). Tap surface is the entire row.
 *
 * `subtitle` is optional; without it the title sits centered.
 * `divider` (default true) draws a hairline separator at the bottom;
 * pass `false` for the last row of a group to avoid stacked dividers.
 */
type ListItemProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  divider = true,
  destructive
}: ListItemProps) {
  const titleColor = destructive ? "text-destructive" : "text-foreground";
  const inner = (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 min-h-[56px] ${
        divider ? "border-b border-border" : ""
      }`}
    >
      {leading ? <View>{leading}</View> : null}
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-body font-semibold ${titleColor}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-caption text-foreground-muted"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
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
      className="active:bg-background-muted"
    >
      {inner}
    </Pressable>
  );
}
