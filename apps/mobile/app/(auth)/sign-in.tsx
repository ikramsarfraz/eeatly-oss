import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  View
} from "react-native";
import { authClient } from "../../lib/auth/client";
import { API_BASE_URL } from "../../lib/api-base";
import { useThemeColors } from "../../lib/design/use-theme-colors";
import { Button, Input, PageTitle, Screen } from "../../components/ui";

/**
 * Sign-in — mirrors the web AuthEmailForm (sign-in mode):
 * password by default, with a toggle to the magic link. Copy strings are
 * reused verbatim from `apps/web/components/forms/auth-email-form.tsx` so the
 * two platforms read identically.
 *
 *   - Password: `authClient.signIn.email` returns a `set-auth-token` header
 *     that the client's `onResponse` hook persists (see lib/auth/client.ts),
 *     so a successful sign-in routes straight to the authed app, no email
 *     round-trip.
 *   - Magic link: unchanged from R18 — dispatches an `eeatly://verify` link
 *     and shows the "check your email" confirmation; `app/verify.tsx` finishes.
 *
 * Forgot-password and password sign-up stay on the web (the reset link opens
 * the web `/reset-password` page); "Forgot password?" deep-links out to it.
 */

const MIN_PASSWORD_LENGTH = 8;

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function SignIn() {
  const colors = useThemeColors();
  const [method, setMethod] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const usePassword = method === "password";
  const isSubmitting = status.kind === "submitting";

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setStatus({ kind: "error", message: "Enter a valid email address." });
      return;
    }

    if (usePassword) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setStatus({
          kind: "error",
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        });
        return;
      }
      setStatus({ kind: "submitting" });
      try {
        const { error } = await authClient.signIn.email({
          email: trimmed,
          password
        });
        if (error) {
          setStatus({
            kind: "error",
            message:
              error.code === "INVALID_EMAIL_OR_PASSWORD"
                ? "That email and password don't match. Try again, or email yourself a link."
                : (error.message ?? "Something went wrong. Please try again.")
          });
          return;
        }
        // Session token persisted by the client's onResponse hook.
        router.replace("/(authed)/home");
      } catch {
        setStatus({
          kind: "error",
          message: "Sign-in is temporarily unavailable. Please try again later."
        });
      }
      return;
    }

    // Magic-link method — dispatch a one-tap link, no password.
    setStatus({ kind: "submitting" });
    try {
      const { error } = await authClient.signIn.magicLink({
        email: trimmed,
        callbackURL: "eeatly://verify"
      });
      if (error) {
        setStatus({
          kind: "error",
          message: error.message ?? "Couldn't send the sign-in link. Try again."
        });
        return;
      }
      setStatus({ kind: "sent" });
    } catch (e) {
      setStatus({
        kind: "error",
        message:
          e instanceof Error
            ? e.message
            : "Network error. Check your connection and try again."
      });
    }
  }

  function toggleMethod() {
    setStatus({ kind: "idle" });
    setMethod((m) => (m === "password" ? "link" : "password"));
  }

  function openForgotPassword() {
    void Linking.openURL(`${API_BASE_URL}/forgot-password`);
  }

  if (status.kind === "sent") {
    return (
      <Screen edges={["top", "bottom"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 30,
            gap: 14
          }}
        >
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
            className="font-display text-display-xs text-ink dark:text-ink-dark text-center"
            style={{ letterSpacing: -0.4 }}
          >
            Check your email.
          </Text>
          <Text className="font-body text-body-lg text-ink-2 dark:text-ink-2-dark text-center max-w-[320px]">
            We sent a sign-in link to{" "}
            <Text className="font-body-semibold text-ink dark:text-ink-dark">
              {email.trim().toLowerCase()}
            </Text>
            . Tap it on this phone to finish signing in.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Button variant="ghost" onPress={() => setStatus({ kind: "idle" })}>
              Use a different email
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  const errorMessage = status.kind === "error" ? status.message : undefined;

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 30, gap: 18 }}
        >
          <View>
            <Text
              className="font-display-italic text-kicker text-ink-2 dark:text-ink-2-dark"
              style={{ marginBottom: 4 }}
            >
              Welcome to
            </Text>
            <PageTitle title="eeatly." size="lg" />
            <Text
              className="font-body text-body-lg text-ink-2 dark:text-ink-2-dark mt-3"
              style={{ lineHeight: 22 }}
            >
              {usePassword
                ? "Sign in with your email and password."
                : "Sign in with your email, no password needed."}
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
            editable={!isSubmitting}
            mono
          />

          {usePassword ? (
            <View style={{ gap: 8 }}>
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                  style={{ letterSpacing: -0.1 }}
                >
                  Password
                </Text>
                <Pressable onPress={openForgotPassword} hitSlop={8} accessibilityRole="link">
                  <Text className="font-body text-body-md text-ink-3 dark:text-ink-3-dark">
                    Forgot password?
                  </Text>
                </Pressable>
              </View>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                placeholder="Your password"
                editable={!isSubmitting}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
                trailingAccessory={
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.ink3}
                    />
                  </Pressable>
                }
              />
            </View>
          ) : null}

          {errorMessage ? (
            <Text className="font-body text-body-md text-danger dark:text-danger-dark">
              {errorMessage}
            </Text>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={handleSubmit}
          >
            {usePassword ? "Sign in" : "Send sign-in link"}
          </Button>

          <Pressable onPress={toggleMethod} hitSlop={8}>
            <Text
              className="font-body text-body-md text-ink-3 dark:text-ink-3-dark text-center"
            >
              {usePassword
                ? "Email me a sign-in link instead (no password)"
                : "Use a password instead"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
