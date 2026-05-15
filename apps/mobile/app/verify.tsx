import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AUTH_URL } from "../lib/api-base";
import { setSessionToken } from "../lib/auth/session";

/**
 * Round 12 — deep-link target for `eeatly://verify?token=<ml_token>`.
 * The user got here by tapping the email link. We have the
 * magic-link token (NOT the session token yet); the job is to
 * exchange it for a Better Auth session.
 *
 *   1. Read `token` from the deep-link URL params.
 *   2. Call Better Auth's standard verify endpoint via fetch. The
 *      server validates the magic-link token, creates a session, and
 *      responds with the new session token in `set-auth-token`
 *      (added by the bearer plugin, Round 12 Task 3).
 *   3. Persist the token in SecureStore.
 *   4. Bounce to `(authed)` so Task 6's home screen takes over.
 *
 * The Better Auth client's `onResponse` hook (in `lib/auth/client.ts`)
 * would also capture the token if we called this endpoint through the
 * client. We use raw `fetch` here because the verify endpoint isn't
 * shaped as a regular client method — it's a GET that Better Auth
 * issues server-side from its own endpoint table. Raw fetch + manual
 * persist is simpler than wiring this one call through the client.
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
          message: "This sign-in link is missing its token. Open the link from your email."
        });
        return;
      }
      try {
        const url = `${AUTH_URL}/magic-link/verify?token=${encodeURIComponent(token)}`;
        // `redirect: "manual"` keeps the response object accessible so
        // we can read headers. Better Auth's verify endpoint normally
        // 302's to the callbackURL — for mobile we don't care about
        // the redirect target, just the `set-auth-token` header.
        const res = await fetch(url, {
          method: "GET",
          redirect: "manual",
          headers: { origin: "eeatly://" }
        });
        if (cancelled) return;
        const sessionToken = res.headers.get("set-auth-token");
        if (!sessionToken) {
          // Either Better Auth rejected the magic-link token (expired,
          // already used, malformed) or the bearer plugin didn't emit
          // the header. We surface the raw body for debugging in dev;
          // production users see only the generic message above.
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
        router.replace("/(authed)/home");
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
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.subtle}>Finishing sign-in…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Couldn't sign you in</Text>
      <Text style={styles.body}>{state.message}</Text>
      <Pressable
        onPress={() => router.replace("/(auth)/sign-in")}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "600"
  },
  subtle: {
    fontSize: 13,
    color: "#666",
    marginTop: 8
  },
  body: {
    fontSize: 14,
    color: "#444",
    textAlign: "center"
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2f6f58"
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});
