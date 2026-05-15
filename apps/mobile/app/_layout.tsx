import "../global.css";

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
 * Round 17 added the `global.css` import — it has to be the very first
 * import in the entry tree so NativeWind's runtime registry is
 * populated before any screen reads it. The CSS file holds the
 * Tailwind directives that Metro's nativewind transform compiles.
 *
 * Status bar uses `dark` content on the cream background per R17
 * design tokens.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#FBF8F1" />
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    </SafeAreaProvider>
  );
}
