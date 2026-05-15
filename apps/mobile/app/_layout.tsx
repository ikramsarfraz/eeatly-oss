import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "../lib/providers";

/**
 * Round 12 — root layout. Wraps the entire app in `AppProviders`
 * (TRPC + React Query) before the navigation stack so every screen
 * can use the typed hooks. SafeAreaProvider is outermost so the
 * provider tree can read insets if needed.
 *
 * Style decisions stay raw RN primitives for Phase 1 (handoff rule).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    </SafeAreaProvider>
  );
}
