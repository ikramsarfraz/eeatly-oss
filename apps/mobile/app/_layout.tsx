import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "../lib/providers";
import { useAppFonts } from "../lib/design/use-app-fonts";
import { colors } from "../lib/design/tokens";

/**
 * Round 18 root layout. Loads the three editorial families
 * (Instrument Serif, Geist, JetBrains Mono) before rendering the nav
 * tree — without them every screen would flash in the platform default
 * before the warm-cream UI snaps in.
 *
 * `global.css` must be the very first import so NativeWind's runtime
 * registry is populated before any screen reads it. `AppProviders`
 * wraps TRPC + React Query so every screen can use the typed hooks.
 */
export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.cream} />
      <AppProviders>
        {fontsLoaded ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream }
            }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.cream }} />
        )}
      </AppProviders>
    </SafeAreaProvider>
  );
}
