import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { TopNav } from "../../../../../components/top-nav";
import { colors } from "../../../../../lib/design/tokens";
import {
  useRefineSession,
  type PendingChange
} from "../../../../../lib/refine-session";
import { trpc } from "../../../../../lib/trpc";
import {
  Card,
  Chip,
  EmptyState,
  Screen,
  SectionLabel
} from "../../../../../components/ui";

/**
 * Round 20 — Review changes screen.
 *
 * Reached from the Refine screen's "Review & save" CTA. Renders the
 * flattened diff before committing.
 *
 * Stack:
 *   - TopNav with text "Back" left + "Save" right (right is the
 *     primary commit affordance; the bottom CTA mirrors for thumb
 *     reach).
 *   - Editorial headline — italic "N changes," kicker + serif "ready
 *     to save." + mono "RECIPE NAME · REFINED JUST NOW".
 *   - Totals chip row — `+N additions` (sage), `~N changes` (wheat),
 *     `N removals` (ghost).
 *   - Diff list — grouped Card with one row per change: dot icon +
 *     title + mono "<Action> · <where>" + chevron, and an indented
 *     mono diff (before / after).
 *   - Heads-up sage card explaining a known side effect when a
 *     pending change crosses an effort threshold (rule-based, not AI).
 *   - Footer: forest "Save N changes" + outline "Keep refining".
 *
 * Save is a UI no-op for now — calls `applyPending` which simulates a
 * round-trip and clears the session. Will become a real
 * `meals.applyRefinements` mutation when the backend procedure ships.
 */

export default function RefineReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = typeof id === "string" ? id : "";

  const query = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );
  const { session, counts, applyPending } = useRefineSession(mealId);
  const [saving, setSaving] = useState(false);

  const headsUp = useMemo(
    () => computeHeadsUp(session.pending, query.data?.effortLevel ?? null),
    [session.pending, query.data?.effortLevel]
  );

  async function handleSave() {
    setSaving(true);
    try {
      await applyPending();
      // No tRPC invalidation yet — `applyPending` is a no-op until the
      // backend procedure exists. Once wired, invalidate
      // `meals.getById` so the detail screen reflects the save.
      Alert.alert(
        "Saved",
        "Refinement save is wired through the UI only — backend persistence ships in the next round."
      );
      router.replace(`/(authed)/meal/${mealId}` as never);
    } catch (e) {
      Alert.alert(
        "Couldn't save",
        e instanceof Error ? e.message : "Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (counts.total === 0) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Review changes" back showSettings={false} />
        <EmptyState
          icon={
            <Ionicons name="sparkles-outline" size={28} color={colors.forest} />
          }
          title="Nothing to review"
          body="Head back to Refine and try a prompt — your changes batch here for one save."
        />
      </Screen>
    );
  }

  const recipeName = query.data?.name ?? "Recipe";
  const refinedEyebrow = `${recipeName} · refined just now`.toUpperCase();

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Review changes"
        leftLabel="Back"
        onLeftPress={() => router.back()}
        showSettings={false}
        right={
          <Pressable
            hitSlop={10}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 15,
                color: colors.forest,
                opacity: saving ? 0.5 : 1
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 8,
          paddingBottom: 40
        }}
      >
        <View style={{ marginBottom: 22 }}>
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular_Italic",
              fontSize: 18,
              color: colors.ink2,
              letterSpacing: 0.1,
              marginBottom: 4
            }}
          >
            {`${counts.total} change${counts.total === 1 ? "" : "s"},`}
          </Text>
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular",
              fontSize: 40,
              lineHeight: 40 * 0.98,
              color: colors.ink,
              letterSpacing: -0.8,
              marginBottom: 10
            }}
          >
            ready to save.
          </Text>
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 11,
              color: colors.ink3,
              letterSpacing: 1.3,
              textTransform: "uppercase"
            }}
            numberOfLines={2}
          >
            {refinedEyebrow}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 22
          }}
        >
          <Chip tone="sage">{`+${counts.add} addition${counts.add === 1 ? "" : "s"}`}</Chip>
          <Chip tone="wheat">{`~${counts.change} change${counts.change === 1 ? "" : "s"}`}</Chip>
          <Chip tone="ghost">{`${counts.remove} removal${counts.remove === 1 ? "" : "s"}`}</Chip>
        </View>

        <SectionLabel
          action={
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 12.5,
                color: colors.forest,
                letterSpacing: -0.05
              }}
            >
              Accept all
            </Text>
          }
        >
          Diff
        </SectionLabel>

        <Card style={{ marginBottom: 18, overflow: "hidden" }}>
          {session.pending.map((change, i) => (
            <ReviewRow
              key={change.id}
              change={change}
              isLast={i === session.pending.length - 1}
            />
          ))}
        </Card>

        {headsUp ? (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
              padding: 16,
              borderRadius: 14,
              backgroundColor: "#EDEEDF",
              borderWidth: 1,
              borderColor: "#DBDFC4",
              marginBottom: 22
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.forest}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 13,
                  color: colors.ink,
                  letterSpacing: -0.1,
                  marginBottom: 4
                }}
              >
                Heads up
              </Text>
              <Text
                style={{
                  fontFamily: "Geist_400Regular",
                  fontSize: 12.5,
                  color: colors.ink2,
                  lineHeight: 18
                }}
              >
                {headsUp}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={`Save ${counts.total} changes`}
            style={{
              paddingVertical: 16,
              paddingHorizontal: 22,
              borderRadius: 99,
              backgroundColor: colors.forest,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: saving ? 0.7 : 1,
              shadowColor: colors.forest,
              shadowOpacity: 0.35,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 20,
              elevation: 4
            }}
            className="active:opacity-90"
          >
            <Ionicons name="checkmark" size={18} color={colors.forestText} />
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 15.5,
                color: colors.forestText,
                letterSpacing: -0.1
              }}
            >
              {saving
                ? "Saving…"
                : `Save ${counts.total} change${counts.total === 1 ? "" : "s"}`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Keep refining"
            style={{
              paddingVertical: 14,
              paddingHorizontal: 22,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "transparent",
              alignItems: "center"
            }}
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 14,
                color: colors.ink2,
                letterSpacing: -0.05
              }}
            >
              Keep refining
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ReviewRow({
  change,
  isLast
}: {
  change: PendingChange;
  isLast: boolean;
}) {
  const palette =
    change.kind === "add"
      ? {
          bg: colors.sageBg,
          fg: colors.forest,
          icon: "add" as const,
          label: "Added"
        }
      : change.kind === "change"
        ? {
            bg: "#F4EEDB",
            fg: "#8A6B22",
            icon: "arrow-forward" as const,
            label: "Changed"
          }
        : {
            bg: colors.dangerSoft,
            fg: colors.danger,
            icon: "remove" as const,
            label: "Removed"
          };
  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSoft
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 8
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 99,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name={palette.icon} size={12} color={palette.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 13.5,
              color: colors.ink,
              letterSpacing: -0.1
            }}
            numberOfLines={2}
          >
            {change.label}
          </Text>
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 10,
              color: colors.ink3,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              marginTop: 2
            }}
            numberOfLines={2}
          >
            {`${palette.label} · ${change.where}`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
      </View>
      {change.kind === "change" || change.kind === "remove" ? (
        <View style={{ marginLeft: 32, gap: 4 }}>
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 12.5,
              color: colors.ink3,
              letterSpacing: 0.3,
              textDecorationLine: "line-through",
              textDecorationColor: colors.ink4
            }}
          >
            {change.before}
          </Text>
          {change.kind === "change" ? (
            <Text
              style={{
                fontFamily: "JetBrainsMono_600SemiBold",
                fontSize: 12.5,
                color: colors.ink2,
                letterSpacing: 0.3
              }}
            >
              {change.after}
            </Text>
          ) : null}
        </View>
      ) : null}
      {change.kind === "add" ? (
        <View style={{ marginLeft: 32 }}>
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              fontSize: 12.5,
              color: colors.ink2,
              letterSpacing: 0.3
            }}
          >
            {change.after}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Rule-based heads-up generator. The handoff specifies a small table of
 * threshold checks (chicken weight bumping effort, ingredient count
 * exceeding effort tier, etc.). This first cut covers just the chicken
 * weight case shown in the mock — additional rules can layer in as we
 * discover more side effects worth surfacing.
 */
function computeHeadsUp(
  pending: PendingChange[],
  currentEffort: string | null
): string | null {
  if (!currentEffort || currentEffort === "high_effort") return null;
  const chickenBump = pending.find(
    (p) =>
      p.kind === "change" &&
      /chicken/i.test(p.label) &&
      /600\s*g/.test(p.after) &&
      /400\s*g/.test(p.before)
  );
  if (!chickenBump) return null;
  return "Bumping the chicken to 600 g pushes effort from medium to high. Tap to keep medium.";
}
