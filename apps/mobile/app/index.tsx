import { useEffect, useState } from "react";
import { router } from "expo-router";
import { getSessionToken } from "../lib/auth/session";
import { LoadingScreen } from "../components/ui";

/**
 * Round 12 / 13 — landing route. Checks SecureStore for a persisted
 * session token and routes accordingly:
 *   - token present → `/(authed)/home`
 *   - no token → `/(auth)/sign-in`
 *
 * Renders the shared loading screen on cream while the SecureStore
 * read settles (R17 — was a bare ActivityIndicator before).
 */
export default function Index() {
  const [routed, setRouted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function decide() {
      const token = await getSessionToken();
      if (cancelled) return;
      router.replace(token ? "/(authed)/home" : "/(auth)/sign-in");
      setRouted(true);
    }
    void decide();
    return () => {
      cancelled = true;
    };
  }, []);

  if (routed) return null;
  return <LoadingScreen />;
}
