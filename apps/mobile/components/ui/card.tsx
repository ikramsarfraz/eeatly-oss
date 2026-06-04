import { Pressable, View } from "react-native";
import type { PressableProps, ViewProps } from "react-native";

/**
 * Round 18 — Card primitive.
 *
 * `default` — surface bg on cream, hairline border, very subtle
 * downward shadow. The everyday card.
 * `interactive` — same surface but pressable; press feedback is a
 * gentle sage-bg tint.
 * `outlined` — border only, no shadow. Cheaper visual weight for
 * dense sections.
 * `flush` — same surface but no internal padding; the consumer lays
 * out grouped rows inside. Used by Settings / Kitchen.
 */
export type CardVariant = "default" | "interactive" | "outlined" | "flush";

type CardProps = ViewProps & {
  variant?: CardVariant;
};

type InteractiveCardProps = Omit<PressableProps, "style"> & {
  variant: "interactive";
  className?: string;
};

// R19 — dark-mode aware. NativeWind picks `dark:` variants via
// `darkMode: 'media'` so consumers don't pass theme props.
const baseByVariant: Record<CardVariant, string> = {
  default:
    "bg-surface dark:bg-surface-dark rounded-lg border border-border-soft dark:border-border-soft-dark shadow-sm",
  interactive:
    "bg-surface dark:bg-surface-dark rounded-lg border border-border-soft dark:border-border-soft-dark shadow-sm active:bg-sage-bg/40 dark:active:bg-sage-bg-dark/40",
  outlined:
    "bg-surface dark:bg-surface-dark rounded-lg border border-border-soft dark:border-border-soft-dark",
  flush:
    "bg-surface dark:bg-surface-dark rounded-lg border border-border-soft dark:border-border-soft-dark overflow-hidden"
};

export function Card(props: CardProps | InteractiveCardProps) {
  const { variant = "default", className, ...rest } = props as CardProps & {
    className?: string;
  };
  if (variant === "interactive") {
    const pressable = rest as Omit<PressableProps, "style">;
    return (
      <Pressable
        accessibilityRole="button"
        className={`${baseByVariant.interactive} ${className ?? ""}`}
        {...pressable}
      />
    );
  }
  return (
    <View
      className={`${baseByVariant[variant]} ${className ?? ""}`}
      {...(rest as ViewProps)}
    />
  );
}

/**
 * Optional padding helpers — used when consumers want consistent inner
 * spacing without manually adding `p-4`.
 */
export function CardHeader({
  className,
  ...rest
}: ViewProps & { className?: string }) {
  return <View className={`px-4 pt-4 pb-2 ${className ?? ""}`} {...rest} />;
}

export function CardBody({
  className,
  ...rest
}: ViewProps & { className?: string }) {
  return <View className={`px-4 py-4 ${className ?? ""}`} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: ViewProps & { className?: string }) {
  return (
    <View
      className={`px-4 pt-2 pb-4 flex-row items-center justify-end gap-2 ${className ?? ""}`}
      {...rest}
    />
  );
}
