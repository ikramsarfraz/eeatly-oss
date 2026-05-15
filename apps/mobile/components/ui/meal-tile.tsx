import { Image, Text, View } from "react-native";
import { fonts, mealPalette } from "../../lib/design/tokens";

/**
 * Round 18 — the signature visual element.
 *
 * Every meal/dish thumbnail throughout the app is a typographic
 * monogram tile: a colored square with the dish's first letter set
 * in Instrument Serif italic, a faint dotted texture, and a hairline
 * inner frame. The palette is hashed off the dish name, so the same
 * dish always renders in the same color across Home / Plans / Library
 * — that consistency is what makes the app feel like it remembers
 * the cooking, not just a database of strings.
 *
 * Photo override: if `photoUrl` is supplied the tile renders the
 * photo at the same dimensions and radius. The monogram is the empty
 * state, not a fallback.
 *
 * Sizes mirror the handoff:
 *   - `xl` 148pt — Home "recently cooked" carousel
 *   - `lg` 96pt-ish — generic
 *   - `md` 64pt — "most cooked" grid tiles
 *   - `sm` 40pt — list-row thumbnails
 *
 * The dotted texture is faked with a 4×4 grid of tiny absolute dots
 * because RN's stylesheet has no radial-gradient — visually close
 * enough at the scales we render at.
 */
export type MealTileSize = "xl" | "lg" | "md" | "sm";

type MealTileProps = {
  name: string;
  size?: MealTileSize;
  photoUrl?: string | null;
  /** Optional radius override. Defaults are tuned per size. */
  radius?: number;
};

const FONT_SIZE: Record<MealTileSize, number> = {
  xl: 124,
  lg: 96,
  md: 64,
  sm: 40
};

const DEFAULT_RADIUS: Record<MealTileSize, number> = {
  xl: 10,
  lg: 8,
  md: 8,
  sm: 8
};

export function MealTile({ name, size = "lg", photoUrl, radius }: MealTileProps) {
  const r = radius ?? DEFAULT_RADIUS[size];

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Photo of ${name}`}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: r,
          backgroundColor: "#EFE7D6"
        }}
        resizeMode="cover"
      />
    );
  }

  const palette = mealPalette(name);
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  const fontSize = FONT_SIZE[size];

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        borderRadius: r,
        backgroundColor: palette.bg,
        overflow: "hidden"
      }}
    >
      <DotTexture color={palette.dot} />
      <View
        style={{
          ...StyleSheetCenter,
          paddingTop: fontSize * 0.04
        }}
      >
        <Text
          style={{
            fontFamily: fonts.displayItalic,
            color: palette.fg,
            fontSize,
            lineHeight: fontSize * 0.9,
            letterSpacing: -fontSize * 0.04
          }}
          allowFontScaling={false}
        >
          {letter}
        </Text>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          right: 6,
          bottom: 6,
          borderRadius: Math.max(0, r - 2),
          borderWidth: 1,
          borderColor: palette.dot + "66"
        }}
      />
    </View>
  );
}

// 8-row × 8-col dot grid — RN has no radial-gradient primitive, so we
// approximate with a small grid of absolutely-positioned dots. Cheap
// to render, no canvas/svg needed, and the eye reads it as texture.
function DotTexture({ color }: { color: string }) {
  const rows = 8;
  const cols = 8;
  const dots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      dots.push({ x: j / (cols - 1), y: i / (rows - 1) });
    }
  }
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.55
      }}
    >
      {dots.map((d, idx) => (
        <View
          key={idx}
          style={{
            position: "absolute",
            top: `${d.y * 100}%`,
            left: `${d.x * 100}%`,
            width: 2,
            height: 2,
            marginLeft: -1,
            marginTop: -1,
            borderRadius: 1,
            backgroundColor: color
          }}
        />
      ))}
    </View>
  );
}

const StyleSheetCenter = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: "center" as const,
  justifyContent: "center" as const
};
