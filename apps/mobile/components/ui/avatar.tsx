import { Text, View } from "react-native";
import { colors, fonts } from "../../lib/design/tokens";

/**
 * Round 18 — initials avatar in the editorial style.
 *
 * The kitchen members screen renders avatars with a wheat-tinted bg
 * and a single Instrument Serif italic letter — `M.` for Mom, with the
 * trailing period intentional. We approximate that here: take the
 * first letter and append a period, render it in the serif italic.
 *
 * For consistency across household members we still hash a palette so
 * different members get different warm-tinted backgrounds, but the
 * default leans toward the wheat shown in the handoff.
 */
type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
};

const sizeClasses: Record<AvatarSize, { box: string; fontSize: number }> = {
  sm: { box: "h-8 w-8", fontSize: 14 },
  md: { box: "h-11 w-11", fontSize: 22 },
  lg: { box: "h-14 w-14", fontSize: 28 }
};

const palette = [
  { bg: colors.wheat, fg: "#5C4318" },
  { bg: "#C9D3B5", fg: "#2E4A22" },
  { bg: "#E2C6BC", fg: "#5C2C1A" },
  { bg: "#C7D1D9", fg: "#2B3B49" }
];

function pickColor(initials: string) {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = (hash << 5) - hash + initials.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ initials, size = "md" }: AvatarProps) {
  const clean = (initials || "?").trim();
  const letter = clean.charAt(0).toUpperCase();
  const color = pickColor(clean || "??");
  const dims = sizeClasses[size];
  return (
    <View
      className={`items-center justify-center rounded-full ${dims.box}`}
      style={{ backgroundColor: color.bg }}
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${clean}`}
    >
      <Text
        style={{
          fontFamily: fonts.displayItalic,
          fontSize: dims.fontSize,
          color: color.fg,
          letterSpacing: -0.4,
          lineHeight: dims.fontSize
        }}
        allowFontScaling={false}
      >
        {letter}.
      </Text>
    </View>
  );
}
