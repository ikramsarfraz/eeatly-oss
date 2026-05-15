import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Round 13 — list-row tile for meal surfaces (recent / most-cooked /
 * neglected). Phone-first: ≥80px tall, full-width pressable area for
 * fat-fingered taps. Photo on the left (with a placeholder gradient
 * if missing), name + subtitle on the right.
 *
 * Tapping anywhere on the row routes to `/meal/[id]` — the recipe
 * view from Task 5. The href is a typed `expo-router` Link target so
 * mistyped routes fail at build time.
 */
export type MealTileProps = {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
  /** Caller-formatted subtitle line ("Cooked 4 times" / "Last May 2"). */
  subtitle: string;
};

export function MealTile({ mealId, mealName, photoUrl, subtitle }: MealTileProps) {
  return (
    <Link href={`/(authed)/meal/${mealId}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mealName}. ${subtitle}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.placeholderText}>
              {mealName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {mealName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 80,
    gap: 14,
    backgroundColor: "#fff"
  },
  pressed: {
    backgroundColor: "#f5f4ef"
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#e8e6df"
  },
  photoPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  placeholderText: {
    fontSize: 22,
    color: "#7a7a7a",
    fontWeight: "500"
  },
  body: {
    flex: 1,
    gap: 4
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111"
  },
  subtitle: {
    fontSize: 13,
    color: "#666"
  }
});
