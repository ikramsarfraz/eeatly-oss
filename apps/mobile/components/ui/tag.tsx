import { Text, View } from "react-native";

/**
 * Round 18 — small pill tag, retained for backwards compatibility with
 * a few places (verdicts, source attribution) that need finer-grained
 * tone variants than `Chip` exposes.
 *
 * New code should prefer `<Chip>` from `./chip` for sage/wheat/terra
 * pills; `<Tag>` is here for default/accent/muted/primary/destructive
 * coverage on grids that already use it.
 */
export type TagVariant =
  | "default"
  | "accent"
  | "muted"
  | "primary"
  | "destructive";

const containerByVariant: Record<TagVariant, string> = {
  default: "bg-cream-soft",
  accent: "bg-wheat",
  muted: "bg-border",
  primary: "bg-forest",
  destructive: "bg-danger-soft"
};

const labelByVariant: Record<TagVariant, string> = {
  default: "text-ink",
  accent: "text-ink",
  muted: "text-ink-2",
  primary: "text-forest-text",
  destructive: "text-danger"
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
        className={`font-body-semibold text-chip ${labelByVariant[variant]}`}
        style={{ letterSpacing: -0.05 }}
      >
        {children}
      </Text>
    </View>
  );
}
