import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

/**
 * Round 17 — screen scaffold.
 *
 * Every screen wraps its content in `<Screen>` so the cream background
 * + safe-area treatment is consistent. Pass `edges` to opt out of
 * top safe-area when a custom header (e.g. expo-router stack title)
 * is already rendered.
 *
 * `<ScreenCentered>` is a sibling helper for loading / error /
 * empty states — vertically centered content on the same cream
 * surface.
 */
type ScreenProps = {
  children: ReactNode;
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function Screen({ children, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenCentered({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        {children}
      </View>
    </SafeAreaView>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <ScreenCentered>
      <ActivityIndicator color="#2C5F3F" size="large" />
      {label ? (
        <Text className="text-body text-foreground-muted">{label}</Text>
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
      <View className="h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <Ionicons name="alert-circle-outline" size={32} color="#A03830" />
      </View>
      <Text className="text-heading-2 font-semibold text-foreground text-center">
        {title}
      </Text>
      {body ? (
        <Text className="text-body text-foreground-muted text-center max-w-[280px]">
          {body}
        </Text>
      ) : null}
    </ScreenCentered>
  );
}
