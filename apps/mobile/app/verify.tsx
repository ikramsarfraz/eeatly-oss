import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AUTH_URL } from "../lib/api-base";
import {
  clearPendingInvite,
  getPendingInvite
} from "../lib/auth/pending-invite";
import { setSessionToken } from "../lib/auth/session";
import {
  Button,
  ErrorScreen,
  LoadingScreen
} from "../components/ui";

/**
 * Round 17 verify — NativeWind rebuild.
 *
 * Deep-link target for `eeatly://verify?token=<ml_token>`. The user
 * arrived by tapping the email link; we exchange the magic-link
 * token for a Better Auth session, persist it in SecureStore, and
 * route into the app.
 *
 * Two visible states: a brief "Finishing sign-in…" loading screen,
 * and an error fallback with a "Try again" button that returns to
 * the sign-in screen.
 */
export default function Verify() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [state, setState] = useState<
    | { kind: "verifying" }
    | { kind: "error"; message: string }
  >({ kind: "verifying" });

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!token) {
        setState({
          kind: "error",
          message:
            "This sign-in link is missing its token. Open the link from your email."
        });
        return;
      }
      try {
        const url = `${AUTH_URL}/magic-link/verify?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          method: "GET",
          redirect: "manual",
          headers: { origin: "eeatly://" }
        });
        if (cancelled) return;
        const sessionToken = res.headers.get("set-auth-token");
        if (!sessionToken) {
          const body = await res.text().catch(() => "");
          setState({
            kind: "error",
            message: `Sign-in failed (${res.status}). The link may have expired — request a new one.${
              __DEV__ && body ? `\n\n${body.slice(0, 200)}` : ""
            }`
          });
          return;
        }
        await setSessionToken(sessionToken);
        const pendingInvite = await getPendingInvite();
        if (pendingInvite) {
          await clearPendingInvite();
          router.replace(`/invite/${pendingInvite}` as never);
        } else {
          router.replace("/(authed)/home");
        }
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "Network error. Check your connection and try again."
        });
      }
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "verifying") {
    return <LoadingScreen label="Finishing sign-in…" />;
  }

  return (
    <>
      <ErrorScreen title="Couldn't sign you in" body={state.message} />
      <Button
        variant="primary"
        size="md"
        onPress={() => router.replace("/(auth)/sign-in")}
      >
        Try again
      </Button>
    </>
  );
}
