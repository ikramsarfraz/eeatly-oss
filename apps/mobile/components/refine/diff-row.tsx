import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
// Aliased static palette for module-scope use; component body still picks
// up theme-aware text/icon colors via useThemeColors below.
import { colors as colorsLight } from "../../lib/design/tokens";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 20 — small diff row used inside the AI reply card on Refine
 * and (a sibling variant) the diff list on Review.
 *
 * Three kinds map to three dot palettes:
 *   - add    → sage-bg + forest plus glyph
 *   - change → wheat-tinted bg + warm-yellow arrow glyph
 *   - remove → danger-soft + danger minus glyph, label strikethrough
 *
 * `note` is an uppercase mono caption rendered beneath the label;
 * pass `null` to suppress.
 */
export type DiffKind = "add" | "change" | "remove";

const PALETTES: Record<
  DiffKind,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  add: { bg: colorsLight.sageBg, fg: colorsLight.forest, icon: "add" },
  change: { bg: "#F4EEDB", fg: "#8A6B22", icon: "arrow-forward" },
  remove: { bg: colorsLight.dangerSoft, fg: colorsLight.danger, icon: "remove" }
};

export function DiffRow({
  kind,
  label,
  note
}: {
  kind: DiffKind;
  label: string;
  note?: string | null;
}) {
  const colors = useThemeColors();
  const palette = PALETTES[kind];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 6
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 99,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1
        }}
      >
        <Ionicons name={palette.icon} size={12} color={palette.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "Geist_500Medium",
            fontSize: 13.5,
            color: colors.ink,
            letterSpacing: -0.1,
            textDecorationLine: kind === "remove" ? "line-through" : "none",
            textDecorationColor: colors.ink4
          }}
        >
          {label}
        </Text>
        {note ? (
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 10,
              color: colors.ink3,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              marginTop: 2
            }}
          >
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
