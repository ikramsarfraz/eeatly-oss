import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text
} from "react-native";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 17/19.5 — top-of-screen toast.
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
  info: "bg-surface dark:bg-surface-dark border border-forest dark:border-forest-dark",
  success: "bg-forest dark:bg-forest-dark",
  error: "bg-danger dark:bg-danger-dark"
};

const labelByVariant: Record<ToastVariant, string> = {
  info: "text-ink dark:text-ink-dark",
  success: "text-forest-text dark:text-forest-text-dark",
  error: "text-forest-text dark:text-forest-text-dark"
};

const iconNameByVariant: Record<
  ToastVariant,
  keyof typeof Ionicons.glyphMap
> = {
  info: "information-circle",
  success: "checkmark-circle",
  error: "alert-circle"
};

export function Toast({
  visible,
  message,
  variant = "info",
  onDismiss,
  durationMs = 3000
}: ToastProps) {
  const colors = useThemeColors();
  // Icon tint flips with the appearance setting. `info`'s icon stays
  // forest-tinted (light or dark variant); success + error keep their
  // cream icon on the colored background.
  const iconColorByVariant: Record<ToastVariant, string> = {
    info: colors.forest,
    success: colors.forestText,
    error: colors.forestText
  };
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
