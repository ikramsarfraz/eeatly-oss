import { forwardRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

/**
 * Round 17 — Input primitive.
 *
 * Composes a label + TextInput + helper/error row. The same component
 * handles single-line and multiline (textarea) via the `multiline`
 * prop — multiline grows to `minHeight=96` rather than the default
 * 44 so longer notes have room to breathe.
 *
 * Focus state is tracked locally so the border can shift to
 * `border-strong` while the field has focus — pure visual affordance,
 * no functional difference. The error variant overrides everything
 * else and shows a red border + red helper text.
 */
type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  helper?: string;
  error?: string;
  variant?: "default" | "error";
  className?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    helper,
    error,
    variant,
    multiline,
    onFocus,
    onBlur,
    className,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const isError = variant === "error" || Boolean(error);

  const borderClass = isError
    ? "border-destructive"
    : focused
      ? "border-border-strong"
      : "border-border";

  return (
    <View className={`gap-1.5 ${className ?? ""}`}>
      {label ? (
        <Text className="text-caption-strong font-semibold text-foreground">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#9A968A"
        className={`
          rounded-md border bg-background-elevated
          px-3 ${multiline ? "py-3 min-h-[96px]" : "h-11"}
          text-body text-foreground
          ${borderClass}
        `}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "auto"}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {error ? (
        <Text className="text-small text-destructive">{error}</Text>
      ) : helper ? (
        <Text className="text-small text-foreground-muted">{helper}</Text>
      ) : null}
    </View>
  );
});
