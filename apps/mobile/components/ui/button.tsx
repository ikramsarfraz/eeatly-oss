import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { PressableProps } from "react-native";
import type { ReactNode } from "react";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 18/19/19.5 — primary Button.
 *
 * Variants:
 *   - `primary` — forest bg, cream label. The default CTA.
 *   - `secondary` — surface bg + sage border + forest label. Sits next
 *     to a primary or stands alone where primary would feel too loud.
 *   - `ghost` — transparent. Used inside cards/sheets where a
 *     bordered button competes with the container.
 *   - `destructive` — danger-soft bg, danger label.
 *   - `outline-destructive` — transparent bg, danger border + label.
 *     Used for the "Leave kitchen" affordance where a filled red would
 *     read too alarming.
 *
 * Sizes:
 *   - `sm` (32px) — inline, compact rows.
 *   - `md` (44px, default) — minimum thumb target.
 *   - `lg` (52px) — full-width primary CTAs.
 *
 * Buttons render pill-shaped (rounded-pill). `leadingIcon` accepts any
 * ReactNode so callers can use Ionicons or any svg.
 *
 * R19.5: dark-mode aware. Every variant pairs light + dark NativeWind
 * classes; the spinner color reads from `useThemeColors()` so the
 * forest token flips correctly when the system appearance changes.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "outline-destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

const containerByVariant: Record<ButtonVariant, string> = {
  primary:
    "bg-forest dark:bg-forest-dark active:bg-forest-deep dark:active:bg-forest-deep-dark",
  secondary:
    "bg-surface dark:bg-surface-dark border border-sage-deep dark:border-sage-deep-dark active:bg-sage-bg dark:active:bg-sage-bg-dark",
  ghost:
    "bg-transparent active:bg-sage-bg dark:active:bg-sage-bg-dark",
  destructive: "bg-danger-soft dark:bg-danger-soft-dark active:opacity-80",
  "outline-destructive":
    "bg-transparent border border-danger/40 dark:border-danger-dark/40 active:bg-danger-soft dark:active:bg-danger-soft-dark"
};

const labelByVariant: Record<ButtonVariant, string> = {
  primary: "text-forest-text dark:text-forest-text-dark",
  secondary: "text-forest dark:text-forest-dark",
  ghost: "text-forest dark:text-forest-dark",
  destructive: "text-danger dark:text-danger-dark",
  "outline-destructive": "text-danger dark:text-danger-dark"
};

const heightBySize: Record<ButtonSize, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-5",
  lg: "h-[52px] px-6"
};

const labelSizeBySize: Record<ButtonSize, string> = {
  sm: "text-body-sm",
  md: "text-body-lg",
  lg: "text-body-lg"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leadingIcon,
  fullWidth,
  className,
  ...rest
}: ButtonProps) {
  const colors = useThemeColors();
  // Spinner color matches the label color of the variant — keeps the
  // loading state visually consistent without an extra prop.
  const spinnerColorByVariant: Record<ButtonVariant, string> = {
    primary: colors.forestText,
    secondary: colors.forest,
    ghost: colors.forest,
    destructive: colors.danger,
    "outline-destructive": colors.danger
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-pill
        ${heightBySize[size]}
        ${containerByVariant[variant]}
        ${fullWidth ? "self-stretch" : "self-start"}
        ${isDisabled ? "opacity-50" : ""}
        ${className ?? ""}
      `}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColorByVariant[variant]} size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          {leadingIcon ? <View>{leadingIcon}</View> : null}
          <Text
            className={`font-body-semibold ${labelSizeBySize[size]} ${labelByVariant[variant]}`}
            style={{ letterSpacing: -0.1 }}
            numberOfLines={1}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
