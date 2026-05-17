import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 18/19 — screen scaffold.
 *
 * Wraps content in a warm-cream safe-area background. Pass `edges` to
 * opt out of the top inset when a Stack header is rendered above
 * (e.g. native back-arrow screens).
 *
 * R19: dark-mode aware. The `dark:bg-cream-dark` class auto-flips with
 * `useColorScheme()`. Inline-style consumers further down read from
 * `useThemeColors()` so RN APIs (icon tint, ActivityIndicator color)
 * stay in sync.
 */
type ScreenProps = {
  children: ReactNode;
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function Screen({ children, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-cream-dark" edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenCentered({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-cream-dark">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        {children}
      </View>
    </SafeAreaView>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  const themeColors = useThemeColors();
  return (
    <ScreenCentered>
      <ActivityIndicator color={themeColors.forest} size="large" />
      {label ? (
        <Text className="font-body text-body-lg text-ink-2 dark:text-ink-2-dark">
          {label}
        </Text>
      ) : null}
    </ScreenCentered>
  );
}

export function ErrorScreen({
  title,
  body
}: {
  title: string;
  body?: string;
}) {
  const themeColors = useThemeColors();
  return (
    <ScreenCentered>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-danger-soft dark:bg-danger-soft-dark">
        <Ionicons
          name="alert-circle-outline"
          size={32}
          color={themeColors.danger}
        />
      </View>
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
    </ScreenCentered>
  );
}
