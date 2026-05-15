import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { PressableProps } from "react-native";
import type { ReactNode } from "react";

/**
 * Round 17 — primary Button primitive.
 *
 * Variants:
 *   - `primary` — green bg, cream label. The default CTA.
 *   - `secondary` — cream bg + green border + green label. Sits next
 *     to a primary or stands alone where primary would feel too loud.
 *   - `ghost` — transparent. Used inside surfaces (cards, sheets)
 *     where a bordered button competes with the container.
 *   - `destructive` — red bg, cream label. Delete / leave / sign out.
 *
 * Sizes:
 *   - `sm` (32px) — inline, compact rows.
 *   - `md` (44px, default) — the minimum thumb-friendly target.
 *   - `lg` (52px) — full-width primary CTAs.
 *
 * States: pressed → opacity step; disabled → 50% opacity + no press;
 * loading → spinner replaces label, button stays disabled.
 *
 * `leadingIcon` accepts any ReactNode so callers can use Ionicons,
 * Feather, lucide-react-native, or a custom svg.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  fullWidth?: boolean;
};

const containerByVariant: Record<ButtonVariant, string> = {
  primary: "bg-primary active:bg-primary/90",
  secondary:
    "bg-background-elevated border border-primary active:bg-primary-muted",
  ghost: "bg-transparent active:bg-primary-muted",
  destructive: "bg-destructive active:bg-destructive/90"
};

const labelByVariant: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-primary",
  ghost: "text-primary",
  destructive: "text-destructive-foreground"
};

const heightBySize: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-11 px-4",
  lg: "h-[52px] px-5"
};

const labelSizeBySize: Record<ButtonSize, string> = {
  sm: "text-caption",
  md: "text-body",
  lg: "text-body"
};

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: "#FBF8F1",
  secondary: "#2C5F3F",
  ghost: "#2C5F3F",
  destructive: "#FBF8F1"
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
}: ButtonProps & { className?: string }) {
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
            className={`font-semibold ${labelSizeBySize[size]} ${labelByVariant[variant]}`}
            numberOfLines={1}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
