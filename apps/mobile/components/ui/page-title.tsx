import { Text, View } from "react-native";

/**
 * Round 18 — large serif page title with optional italic kicker and
 * mono date eyebrow underneath. The editorial anchor on Home, Plans,
 * Library, Add, Settings, Kitchen.
 *
 * Sizes:
 *   - `xl` 56pt — first-name Home greeting (`Saif.`)
 *   - `lg` 46pt — plan detail hero
 *   - `md` 44pt — generic page titles (Plans, Library, Add, Settings)
 *   - `sm` 36pt — sub-display (Capture a recipe.)
 *
 * The trailing period after the title is intentional on the home
 * greeting — callers add it as part of the `title` prop.
 */
type PageTitleSize = "xl" | "lg" | "md" | "sm";

const SIZE_TO_TOKEN: Record<PageTitleSize, string> = {
  xl: "text-display-xl",
  lg: "text-display-lg",
  md: "text-display-md",
  sm: "text-display-sm"
};

type PageTitleProps = {
  title: string;
  size?: PageTitleSize;
  /** Italic kicker shown above title in Instrument Serif italic. */
  kicker?: string;
  /** Uppercase mono eyebrow below title (typically a date). */
  eyebrow?: string;
  /** Subtitle paragraph in Geist regular below title. */
  subtitle?: string;
  className?: string;
};

export function PageTitle({
  title,
  size = "md",
  kicker,
  eyebrow,
  subtitle,
  className
}: PageTitleProps) {
  return (
    <View className={`gap-1.5 ${className ?? ""}`}>
      {kicker ? (
        <Text className="font-display-italic text-kicker text-ink-2 dark:text-ink-2-dark">
          {kicker}
        </Text>
      ) : null}
      <Text
        className={`font-display ${SIZE_TO_TOKEN[size]} text-ink dark:text-ink-dark`}
        style={{ letterSpacing: -0.6 }}
        allowFontScaling
      >
        {title}
      </Text>
      {eyebrow ? (
        <Text
          className="font-mono text-label text-ink-3 dark:text-ink-3-dark uppercase mt-1"
          style={{ letterSpacing: 1.5 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      {subtitle ? (
        <Text className="font-body text-body-md text-ink-2 dark:text-ink-2-dark mt-1">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
