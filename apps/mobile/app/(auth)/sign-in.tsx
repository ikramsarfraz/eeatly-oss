import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { authClient } from "../../lib/auth/client";
import { Button, Input, Screen } from "../../components/ui";

/**
 * Round 17 sign-in — NativeWind rebuild.
 *
 * Centered single-column layout. Magic-link auth: user types email,
 * we ask the server to dispatch a sign-in link with our `eeatly://`
 * deep-link callback. The actual verification happens in
 * `app/verify.tsx` after the user taps the link.
 *
 * "Check your email" success state replaces the form rather than
 * stacking under it — feels more decisive on a small screen.
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
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-muted">
            <Ionicons name="mail-outline" size={32} color="#2C5F3F" />
          </View>
          <Text className="text-heading-1 font-bold text-foreground text-center">
            Check your email
          </Text>
          <Text className="text-body text-foreground-muted text-center max-w-[320px]">
            We sent a sign-in link to{" "}
            <Text className="font-semibold text-foreground">
              {email.trim().toLowerCase()}
            </Text>
            . Tap it on this phone to finish signing in.
          </Text>
          <View className="mt-2">
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
        <View className="flex-1 justify-center px-8 gap-4">
          <View className="gap-1">
            <Text className="text-display font-bold text-primary">eeatly</Text>
            <Text className="text-body text-foreground-muted">
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

          <Text className="text-small text-foreground-muted text-center">
            We&apos;ll email you a link that opens directly in this app.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
