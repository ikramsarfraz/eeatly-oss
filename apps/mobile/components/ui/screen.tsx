import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors } from "../../lib/design/tokens";

/**
 * Round 18 — screen scaffold.
 *
 * Wraps content in a warm-cream safe-area background. Pass `edges` to
 * opt out of the top inset when a Stack header is rendered above
 * (e.g. native back-arrow screens).
 */
type ScreenProps = {
  children: ReactNode;
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function Screen({ children, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenCentered({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        {children}
      </View>
    </SafeAreaView>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <ScreenCentered>
      <ActivityIndicator color={colors.forest} size="large" />
      {label ? (
        <Text className="font-body text-body-lg text-ink-2">{label}</Text>
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
  return (
    <ScreenCentered>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-danger-soft">
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      </View>
      <Text
        className="font-display text-display-xs text-ink text-center"
        style={{ letterSpacing: -0.4 }}
      >
        {title}
      </Text>
      {body ? (
        <Text className="font-body text-body-lg text-ink-2 text-center max-w-[280px]">
          {body}
        </Text>
      ) : null}
    </ScreenCentered>
  );
}
