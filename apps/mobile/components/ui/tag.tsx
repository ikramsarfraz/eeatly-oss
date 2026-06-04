import { Text, View } from "react-native";

/**
 * Round 18/19.5 — small pill tag, retained for backwards compatibility
 * with a few places (verdicts, source attribution) that need finer-
 * grained tone variants than `Chip` exposes.
 *
 * New code should prefer `<Chip>` from `./chip` for sage/wheat/terra
 * pills; `<Tag>` is here for default/accent/muted/primary/destructive
 * coverage on grids that already use it.
 *
 * NOTE: `<Tag>` and `<Chip>` overlap in scope (both are pill badges).
 * R19.5 keeps both around but flags the duplication for a future
 * dedupe round — until then both carry dark-mode variants.
 */
export type TagVariant =
  | "default"
  | "accent"
  | "muted"
  | "primary"
  | "destructive";

const containerByVariant: Record<TagVariant, string> = {
  default: "bg-cream-soft dark:bg-cream-soft-dark",
  accent: "bg-wheat dark:bg-wheat-dark",
  muted: "bg-border dark:bg-border-dark",
  primary: "bg-forest dark:bg-forest-dark",
  destructive: "bg-danger-soft dark:bg-danger-soft-dark"
};

const labelByVariant: Record<TagVariant, string> = {
  default: "text-ink dark:text-ink-dark",
  accent: "text-ink dark:text-ink-dark",
  muted: "text-ink-2 dark:text-ink-2-dark",
  primary: "text-forest-text dark:text-forest-text-dark",
  destructive: "text-danger dark:text-danger-dark"
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
