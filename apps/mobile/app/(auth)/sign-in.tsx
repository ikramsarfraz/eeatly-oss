import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { authClient } from "../../lib/auth/client";

/**
 * Round 12 — magic-link sign-in. The user enters their email and the
 * mobile app asks the server to dispatch a sign-in link. The actual
 * verification happens in `app/verify.tsx` after the user taps the
 * email link (the server emits a deep link for `eeatly://` callbacks
 * thanks to `pickMagicLinkUrl` in `apps/web/lib/auth/index.ts`).
 *
 * Phase-1 styling: raw RN primitives. UI library decisions are Phase 2.
 */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setState({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const { error } = await authClient.signIn.magicLink({
        email: trimmed,
        // The server-side `pickMagicLinkUrl` helper sees this scheme
        // and substitutes a `eeatly://verify?token=…` link in the
        // email body so iOS/Android open the app directly.
        callbackURL: "eeatly://verify"
      });
      if (error) {
        setState({
          kind: "error",
          message: error.message ?? "Couldn't send the sign-in link. Try again."
        });
        return;
      }
      setState({ kind: "sent" });
    } catch (e) {
      setState({
        kind: "error",
        message:
          e instanceof Error
            ? e.message
            : "Network error. Check your connection and try again."
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a sign-in link to {email.trim().toLowerCase()}. Tap it on this
          phone to finish signing in.
        </Text>
        <Pressable
          onPress={() => setState({ kind: "idle" })}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  const isSending = state.kind === "sending";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>eeatly</Text>
      <Text style={styles.subtitle}>Sign in with your email</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        placeholderTextColor="#999"
        editable={!isSending}
        style={styles.input}
      />

      {state.kind === "error" ? (
        <Text style={styles.error}>{state.message}</Text>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSending}
        style={({ pressed }) => [
          styles.button,
          (isSending || pressed) && styles.buttonPressed
        ]}
      >
        {isSending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send sign-in link</Text>
        )}
      </Pressable>

      <Text style={styles.body}>
        We'll email you a link. No password needed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 32,
    fontWeight: "600"
  },
  subtitle: {
    fontSize: 16,
    color: "#444",
    marginBottom: 4
  },
  input: {
    height: 48,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  body: {
    fontSize: 13,
    color: "#666"
  },
  error: {
    color: "#b91c1c",
    fontSize: 13
  },
  linkButton: {
    marginTop: 4
  },
  linkText: {
    color: "#2f6f58",
    fontSize: 14
  }
});
