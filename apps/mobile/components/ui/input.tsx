import { forwardRef, useState, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 18/19/19.5 — Input primitive.
 *
 * Composes a label + TextInput + helper/error row. Multiline grows to
 * `minHeight=96` so longer notes have room to breathe.
 *
 * Focus state shifts the border to the deeper sage so the field
 * visibly responds without going green/blue like a system input. The
 * error variant overrides everything else and shows a danger border +
 * danger helper text.
 *
 * R19.5: dark-mode aware. Border + bg + text colors all carry `dark:`
 * variants; the placeholder tint reads from `useThemeColors()` so the
 * RN `placeholderTextColor` prop (which doesn't accept Tailwind
 * classes) flips with system appearance.
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
  /** Optional element pinned to the trailing edge inside the field, e.g.
   *  a password show/hide toggle. Adds right padding so text never runs
   *  under it. Single-line fields only. */
  trailingAccessory?: ReactNode;
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
    trailingAccessory,
    ...rest
  },
  ref
) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const isError = variant === "error" || Boolean(error);

  const borderClass = isError
    ? "border-danger dark:border-danger-dark"
    : focused
      ? "border-sage-deep dark:border-sage-deep-dark"
      : "border-border dark:border-border-dark";

  const fontClass = mono
    ? "font-mono"
    : italicSerif
      ? "font-display-italic"
      : "font-body";

  return (
    <View className={`gap-2 ${className ?? ""}`}>
      {label ? (
        <Text
          className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
          style={{ letterSpacing: -0.1 }}
        >
          {label}
        </Text>
      ) : null}
      <View className="relative justify-center">
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink3}
          className={`
            rounded-md border bg-surface dark:bg-surface-dark
            ${trailingAccessory ? "pl-4 pr-12" : "px-4"} ${multiline ? "py-3.5 min-h-[96px]" : "h-12"}
            text-body-lg text-ink dark:text-ink-dark
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
        {trailingAccessory ? (
          <View className="absolute right-0 h-12 w-12 items-center justify-center">
            {trailingAccessory}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text className="font-body text-body-md text-danger dark:text-danger-dark">
          {error}
        </Text>
      ) : helper ? (
        <Text
          className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
          style={{ letterSpacing: 0.5 }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
});
