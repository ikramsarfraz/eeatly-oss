import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { authClient } from "../../lib/auth/client";
import { colors } from "../../lib/design/tokens";
import { Button, Input, PageTitle, Screen } from "../../components/ui";

/**
 * Round 18 sign-in — editorial rebuild.
 *
 * Centered single-column. Magic-link auth: user types email, we ask
 * the server to dispatch a sign-in link with our `eeatly://` deep-link
 * callback. Verification happens in `app/verify.tsx` after the user
 * taps the link.
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
        callbackURL: "eeatly://verify"
      });
      if (error) {
        setState({
          kind: "error",
          message:
            error.message ?? "Couldn't send the sign-in link. Try again."
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
      <Screen edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 14 }}>
          <View
            style={{
              height: 64,
              width: 64,
              borderRadius: 99,
              backgroundColor: colors.sageBg,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name="mail-outline" size={30} color={colors.forest} />
          </View>
          <Text
            className="font-display text-display-xs text-ink text-center"
            style={{ letterSpacing: -0.4 }}
          >
            Check your email.
          </Text>
          <Text className="font-body text-body-lg text-ink-2 text-center max-w-[320px]">
            We sent a sign-in link to{" "}
            <Text className="font-body-semibold text-ink">
              {email.trim().toLowerCase()}
            </Text>
            . Tap it on this phone to finish signing in.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Button
              variant="ghost"
              onPress={() => setState({ kind: "idle" })}
            >
              Use a different email
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  const isSending = state.kind === "sending";

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 30, gap: 18 }}>
          <View>
            <Text
              className="font-display-italic text-kicker text-ink-2"
              style={{ marginBottom: 4 }}
            >
              Welcome to
            </Text>
            <PageTitle title="eeatly." size="lg" />
            <Text
              className="font-body text-body-lg text-ink-2 mt-3"
              style={{ lineHeight: 22 }}
            >
              Sign in with your email — no password needed.
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            editable={!isSending}
            error={state.kind === "error" ? state.message : undefined}
            mono
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isSending}
            onPress={handleSubmit}
          >
            Send sign-in link
          </Button>

          <Text
            className="font-mono text-eyebrow text-ink-3 uppercase text-center"
            style={{ letterSpacing: 1.2 }}
          >
            Magic link · no password
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
