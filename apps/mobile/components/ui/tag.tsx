import { Text, View } from "react-native";

/**
 * Round 17 — small pill tag.
 *
 * Variants:
 *   - `default` — `background-muted` cream chip with foreground text.
 *     Neutral metadata (effort badges, member badges).
 *   - `accent` — gold pill with dark text. Source badges
 *     ("From voice note", "From photo") — keeps attribution
 *     visually distinct from the meal's structural facts.
 *   - `muted` — even subtler, `border` background. Use where a tag
 *     would compete with adjacent content.
 *   - `primary` — green pill with cream text. Selected / active state.
 *   - `destructive` — red. Surface dangerous state (archived, etc.)
 */
export type TagVariant =
  | "default"
  | "accent"
  | "muted"
  | "primary"
  | "destructive";

const containerByVariant: Record<TagVariant, string> = {
  default: "bg-background-muted",
  accent: "bg-accent",
  muted: "bg-border",
  primary: "bg-primary",
  destructive: "bg-destructive/10 border border-destructive/30"
};

const labelByVariant: Record<TagVariant, string> = {
  default: "text-foreground",
  accent: "text-accent-foreground",
  muted: "text-foreground-muted",
  primary: "text-primary-foreground",
  destructive: "text-destructive"
};

type TagProps = {
  children: string;
  variant?: TagVariant;
};

export function Tag({ children, variant = "default" }: TagProps) {
  return (
    <View
      className={`self-start rounded-pill px-2.5 py-1 ${containerByVariant[variant]}`}
    >
      <Text
        className={`text-caption font-semibold ${labelByVariant[variant]}`}
      >
        {children}
      </Text>
    </View>
  );
}
