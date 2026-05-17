import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "../lib/providers";
import { useAppFonts } from "../lib/design/use-app-fonts";
import { colors, colorsDark } from "../lib/design/tokens";

/**
 * Round 19 root layout. Loads the three editorial families (Instrument
 * Serif, Geist, JetBrains Mono) before rendering the nav tree, and
 * flips the status-bar tint + content background between the light
 * and dark cream palettes based on `useColorScheme()`.
 *
 * `global.css` must be the very first import so NativeWind's runtime
 * registry is populated before any screen reads it. `AppProviders`
 * wraps TRPC + React Query so every screen can use the typed hooks.
 *
 * The pre-fonts loading state still paints the cream ground so the
 * splash → first-frame transition stays warm (no white flash).
 */
export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const groundColor = isDark ? colorsDark.cream : colors.cream;

  return (
    <SafeAreaProvider>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={groundColor}
      />
      <AppProviders>
        {fontsLoaded ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: groundColor }
            }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: groundColor }} />
        )}
      </AppProviders>
    </SafeAreaProvider>
  );
}
