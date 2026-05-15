import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * Round 12 — root layout for the eeatly mobile app. Mounts the providers
 * Task 5 wires up (TRPC + React Query) and the navigation stack
 * Expo Router resolves from the `app/` directory.
 *
 * For now the stack is unstyled — Phase 1 ships with RN primitives.
 * Style decisions (NativeWind vs Tamagui vs StyleSheet) live in a
 * future round once there's real UI to design against.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
