import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

/**
 * Round 17 — top-of-screen toast.
 *
 * Variants:
 *   - `info`    — neutral cream w/ green accent (default).
 *   - `success` — green bg, cream text.
 *   - `error`   — red bg, cream text.
 *
 * The component is a controlled overlay — the consumer drives
 * visibility via `visible` and supplies `onDismiss` (auto-fires after
 * `durationMs`, defaults to 3 s). We use a small Animated.timing for
 * slide-in / fade-out rather than reanimated so this stays free of
 * the worklets dependency surface.
 *
 * Caller is responsible for positioning context. The component
 * positions itself absolutely with a top safe-area inset assumption,
 * so the parent screen should mount it above its other content.
 */
type ToastVariant = "info" | "success" | "error";

type ToastProps = {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  durationMs?: number;
};

const containerByVariant: Record<ToastVariant, string> = {
  info: "bg-background-elevated border border-primary",
  success: "bg-primary",
  error: "bg-destructive"
};

const labelByVariant: Record<ToastVariant, string> = {
  info: "text-foreground",
  success: "text-primary-foreground",
  error: "text-destructive-foreground"
};

const iconNameByVariant: Record<
  ToastVariant,
  keyof typeof Ionicons.glyphMap
> = {
  info: "information-circle",
  success: "checkmark-circle",
  error: "alert-circle"
};

const iconColorByVariant: Record<ToastVariant, string> = {
  info: "#2C5F3F",
  success: "#FBF8F1",
  error: "#FBF8F1"
};

export function Toast({
  visible,
  message,
  variant = "info",
  onDismiss,
  durationMs = 3000
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true
      })
    ]).start();
    const handle = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true
        })
      ]).start(() => onDismiss());
    }, durationMs);
    return () => clearTimeout(handle);
  }, [visible, durationMs, onDismiss, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY }], opacity }
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="alert"
        onPress={onDismiss}
        className={`flex-row items-center gap-2 rounded-md px-4 py-3 shadow-md ${containerByVariant[variant]}`}
      >
        <Ionicons
          name={iconNameByVariant[variant]}
          size={20}
          color={iconColorByVariant[variant]}
        />
        <Text
          className={`flex-1 text-body font-semibold ${labelByVariant[variant]}`}
        >
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    zIndex: 50
  }
});
