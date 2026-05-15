import { Pressable, View } from "react-native";
import type { PressableProps, ViewProps } from "react-native";

/**
 * Round 17 — Card primitive.
 *
 * `default` — cream surface on background, subtle shadow.
 * `interactive` — pressable, slight press feedback (use for tiles
 * the user can tap into).
 * `outlined` — border only, no shadow. Cheaper visual weight for
 * sections inside dense layouts.
 */
export type CardVariant = "default" | "interactive" | "outlined";

type CardProps = ViewProps & {
  variant?: CardVariant;
};

type InteractiveCardProps = Omit<PressableProps, "style"> & {
  variant: "interactive";
  className?: string;
};

const baseByVariant: Record<CardVariant, string> = {
  default: "bg-background-elevated rounded-md shadow-sm",
  interactive:
    "bg-background-elevated rounded-md shadow-sm active:bg-background-muted",
  outlined: "bg-background-elevated rounded-md border border-border"
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
 * Optional header / body subcomponents that pad consistently. Callers
 * are free to skip these and lay out content directly — they're just
 * common scaffolding.
 */
export function CardHeader({ className, ...rest }: ViewProps & { className?: string }) {
  return <View className={`px-4 pt-4 pb-2 ${className ?? ""}`} {...rest} />;
}

export function CardBody({ className, ...rest }: ViewProps & { className?: string }) {
  return <View className={`px-4 py-4 ${className ?? ""}`} {...rest} />;
}

export function CardFooter({ className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`px-4 pt-2 pb-4 flex-row items-center justify-end gap-2 ${className ?? ""}`}
      {...rest}
    />
  );
}
