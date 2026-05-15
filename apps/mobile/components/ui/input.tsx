import { forwardRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { colors } from "../../lib/design/tokens";

/**
 * Round 18 — Input primitive.
 *
 * Composes a label + TextInput + helper/error row. Multiline grows to
 * `minHeight=96` so longer notes have room to breathe.
 *
 * Focus state shifts the border to the deeper sage so the field
 * visibly responds without going green/blue like a system input. The
 * error variant overrides everything else and shows a danger border +
 * danger helper text.
 */
type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  helper?: string;
  error?: string;
  variant?: "default" | "error";
  className?: string;
  /** Render the text in mono — used for URL fields and date displays
   *  where the editorial design calls for typewriter rhythm. */
  mono?: boolean;
  /** Render placeholder/notes in italic serif — matches the
   *  "Doubled the garlic…" notes field on the log form. */
  italicSerif?: boolean;
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
    mono,
    italicSerif,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const isError = variant === "error" || Boolean(error);

  const borderClass = isError
    ? "border-danger"
    : focused
      ? "border-sage-deep"
      : "border-border";

  const fontClass = mono
    ? "font-mono"
    : italicSerif
      ? "font-display-italic"
      : "font-body";

  return (
    <View className={`gap-2 ${className ?? ""}`}>
      {label ? (
        <Text
          className="font-body-semibold text-body-md text-ink"
          style={{ letterSpacing: -0.1 }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.ink3}
        className={`
          rounded-md border bg-surface
          px-4 ${multiline ? "py-3.5 min-h-[96px]" : "h-12"}
          text-body-lg text-ink
          ${fontClass}
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
        <Text className="font-body text-body-md text-danger">{error}</Text>
      ) : helper ? (
        <Text
          className="font-mono text-eyebrow text-ink-3 uppercase"
          style={{ letterSpacing: 0.5 }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
});
