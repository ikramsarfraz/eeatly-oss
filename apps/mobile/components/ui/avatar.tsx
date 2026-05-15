import { Text, View } from "react-native";

/**
 * Round 17 — initials avatar.
 *
 * Circle with up to 2 initials. Background color is derived
 * deterministically from the initials string so the same user
 * always renders in the same color across screens, and different
 * users in the same household visually differentiate without
 * needing photos.
 *
 * Sizes: `sm` (24px), `md` (32px, default), `lg` (48px).
 *
 * For real photo avatars we'd swap to an Image source — for now
 * initials cover every authed flow (no profile-photo upload yet).
 */
type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
};

const sizeClasses: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: "h-6 w-6", text: "text-small" },
  md: { box: "h-8 w-8", text: "text-caption" },
  lg: { box: "h-12 w-12", text: "text-body" }
};

// Palette pulled from the design tokens — every option has WCAG-AA
// contrast against the cream text. Adding more options dilutes the
// differentiation; 5 is enough for ~5-person households without
// frequent collisions.
const palette = [
  { bg: "bg-primary", text: "text-primary-foreground" },
  { bg: "bg-accent", text: "text-accent-foreground" },
  { bg: "bg-destructive", text: "text-destructive-foreground" },
  { bg: "bg-border-strong", text: "text-foreground" },
  { bg: "bg-foreground", text: "text-background" }
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
  const clean = initials.slice(0, 2).toUpperCase();
  const color = pickColor(clean || "??");
  const dims = sizeClasses[size];
  return (
    <View
      className={`items-center justify-center rounded-full ${dims.box} ${color.bg}`}
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${clean}`}
    >
      <Text className={`font-semibold ${dims.text} ${color.text}`}>
        {clean}
      </Text>
    </View>
  );
}
