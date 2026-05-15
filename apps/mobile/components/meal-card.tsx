import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

/**
 * Round 17 — horizontal-scroll meal card.
 *
 * Square-ish photo at the top of the card, name + caption underneath.
 * Used on the home dashboard's "recent / most cooked / bring it back"
 * carousels — the wife's primary signal that this is a real product,
 * not a list of strings.
 *
 * The placeholder is a tinted square with the meal's initial — same
 * affordance the recipe-view hero uses so meals without photos still
 * feel intentional, not broken.
 *
 * `accent` adds a subtle accent-color top border. Used by the
 * "bring it back" section to flag that the meal has gone a while
 * without being cooked.
 */
export type MealCardProps = {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
  subtitle: string;
  accent?: boolean;
};

export function MealCard({
  mealId,
  mealName,
  photoUrl,
  subtitle,
  accent
}: MealCardProps) {
  return (
    <Link href={`/(authed)/meal/${mealId}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mealName}. ${subtitle}`}
        className={`w-40 rounded-md bg-background-elevated shadow-sm overflow-hidden active:bg-background-muted ${
          accent ? "border-t-2 border-accent" : ""
        }`}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="w-full h-32 bg-background-muted"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-32 items-center justify-center bg-primary-muted">
            <Ionicons name="restaurant-outline" size={32} color="#2C5F3F" />
          </View>
        )}
        <View className="px-3 py-2.5 gap-0.5">
          <Text
            className="text-body font-semibold text-foreground"
            numberOfLines={1}
          >
            {mealName}
          </Text>
          <Text
            className="text-caption text-foreground-muted"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
