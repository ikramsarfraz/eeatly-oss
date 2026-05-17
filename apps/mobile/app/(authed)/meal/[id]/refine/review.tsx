import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import type {
  HeadsUp,
  PendingChange
} from "@eeatly/api/validators/refine";
import { TopNav } from "../../../../../components/top-nav";
import {
  useThemeColors,
  useIsDark
} from "../../../../../lib/design/use-theme-colors";
import type { ThemeColors } from "../../../../../lib/design/tokens";

/**
 * Wheat palette mirror of the Chip primitive's "wheat" tone, exposed
 * inline so the diff-card change icon and heads-up warn surface can
 * tint without wrapping in `<Chip>`. Dark variant retunes for warm
 * near-black ground.
 */
function wheatPalette(isDark: boolean): {
  bg: string;
  fg: string;
  border: string;
} {
  return isDark
    ? { bg: "#3A2F18", fg: "#C9B176", border: "#4A3F28" }
    : { bg: "#EDDFB7", fg: "#6F571E", border: "#E2D6AC" };
}
import {
  describePendingChange,
  summariseCounts,
  type DisplayChange
} from "../../../../../lib/refine-format";
import { trpc } from "../../../../../lib/trpc";
import {
  Card,
  Chip,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionLabel,
  Toast
} from "../../../../../components/ui";

/**
 * Round 20 — Review changes screen.
 *
 * Reached from the Refine screen's "Review & save" CTA, which passes
 * `?sessionId=<uuid>` so this screen reads the same draft. We never
 * try to look up an active session by `(mealId, deviceId)` here — the
 * session id ride along makes the relationship explicit and lets the
 * Review screen survive an app cold start if the user deep-links into
 * it directly.
 *
 * Stack:
 *   - TopNav (Back / "Review changes" / Save)
 *   - Editorial headline: italic "N changes," + serif "ready to save."
 *     + mono "{NAME} · REFINED JUST NOW"
 *   - Chip row: +N additions / ~N changes / N removals
 *   - Diff list: one row per pending change with target-specific
 *     before/after rendering
 *   - Heads-up cards (stacked) — server-computed (`detectHeadsUp`
 *     rule engine, R18). Render the body verbatim. Interactive
 *     `suggestedAction` overrides are deferred (R20 spec).
 *   - Footer: forest "Save N changes" pill + "Keep refining" link
 *
 * Save flow:
 *   - `trpc.refine.save.mutate({ sessionId })` runs the R18 atomic
 *     apply (ingredients/steps/meals in one transaction, session
 *     status → 'saved'). On success: invalidate `meals.getById` so
 *     the recipe detail repaints with the new rows, show a toast, and
 *     `router.replace` back to recipe detail. We replace rather than
 *     push so the back-stack doesn't strand the saved-and-closed
 *     Refine + Review pair behind the user.
 *   - Errors stay on the screen; the user can retry or hop back to
 *     Refine and tweak.
 */

export default function RefineReviewScreen() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const wheat = wheatPalette(isDark);
  const params = useLocalSearchParams<{
    id: string;
    sessionId?: string | string[];
  }>();
  const mealId = typeof params.id === "string" ? params.id : "";
  const sessionId =
    typeof params.sessionId === "string"
      ? params.sessionId
      : Array.isArray(params.sessionId)
        ? params.sessionId[0]
        : null;

  const mealQuery = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );
  const sessionQuery = trpc.refine.getPendingChanges.useQuery(
    { sessionId: sessionId ?? "" },
    {
      enabled: !!sessionId,
      // The cache may already hold a fresh copy seeded by the Refine
      // screen. Re-running invalidates it if anything changed while
      // we navigated.
      staleTime: 5_000
    }
  );

  const utils = trpc.useUtils();
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    variant: "info" | "success" | "error";
  }>({ visible: false, message: "", variant: "info" });

  const saveMut = trpc.refine.save.useMutation({
    onSuccess: async (result) => {
      // Bust the meal detail cache so structured ingredients/steps
      // repaint with the new rows.
      await Promise.all([
        utils.meals.getById.invalidate({ mealId }),
        utils.dashboard.meals.invalidate()
      ]);
      setToast({
        visible: true,
        message:
          result.applied > 0
            ? `${result.applied} change${result.applied === 1 ? "" : "s"} saved`
            : "Session closed",
        variant: "success"
      });
      // Small delay so the user actually sees the toast before navigation.
      setTimeout(() => {
        router.replace(`/(authed)/meal/${mealId}` as never);
      }, 600);
    },
    onError: (err) => {
      setToast({
        visible: true,
        message: err.message ?? "Couldn't save those changes.",
        variant: "error"
      });
    }
  });

  /* ─── Loading / guard rails ─────────────────────────────────── */

  if (!sessionId) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Review changes" back showSettings={false} />
        <ErrorScreen
          title="No refine session"
          body="Open the refine flow first, then come back here to review."
        />
      </Screen>
    );
  }

  if (mealQuery.isPending || sessionQuery.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Review changes" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!mealQuery.data || !sessionQuery.data) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Review changes" back showSettings={false} />
        <ErrorScreen
          title="Couldn't load review"
          body={
            sessionQuery.error?.message ??
            mealQuery.error?.message ??
            "Try going back and re-opening Refine."
          }
        />
      </Screen>
    );
  }

  const meal = mealQuery.data;
  const session = sessionQuery.data;
  const pending = session.pendingChanges;
  const counts = summariseCounts(pending);

  const resolverCtx = {
    ingredients: meal.structuredIngredients ?? [],
    steps: meal.structuredSteps ?? []
  };

  if (counts.total === 0) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav
          title="Review changes"
          back
          showSettings={false}
        />
        <EmptyState
          icon={
            <Ionicons
              name="sparkles-outline"
              size={28}
              color={colors.forest}
            />
          }
          title="Nothing to review"
          body="Head back to Refine and send a prompt — your changes batch here for one save."
        />
        <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to Refine"
            style={{
              paddingVertical: 14,
              paddingHorizontal: 22,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: colors.border,
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
      </Screen>
    );
  }

  const saving = saveMut.isPending;
  const refinedEyebrow = `${meal.name} · refined just now`.toUpperCase();

  function handleSave() {
    if (!sessionId || saving) return;
    saveMut.mutate({ sessionId });
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Review changes"
        back
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
                fontFamily: "Geist_500Medium",
                fontSize: 12.5,
                color: colors.ink4,
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
          {pending.map((change, i) => (
            <ReviewRow
              key={change.id}
              change={change}
              resolverCtx={resolverCtx}
              isLast={i === pending.length - 1}
              colors={colors}
              wheat={wheat}
            />
          ))}
        </Card>

        {session.headsUp.length > 0 ? (
          <View style={{ gap: 10, marginBottom: 22 }}>
            {session.headsUp.map((h) => (
              <HeadsUpCard
                key={h.id}
                headsUp={h}
                colors={colors}
                wheat={wheat}
              />
            ))}
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
          >
            {saving ? (
              <ActivityIndicator color={colors.forestText} />
            ) : (
              <Ionicons
                name="checkmark"
                size={18}
                color={colors.forestText}
              />
            )}
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
            disabled={saving}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 22,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "transparent",
              alignItems: "center",
              opacity: saving ? 0.5 : 1
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

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </Screen>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function ReviewRow({
  change,
  resolverCtx,
  isLast,
  colors,
  wheat
}: {
  change: PendingChange;
  resolverCtx: Parameters<typeof describePendingChange>[1];
  isLast: boolean;
  colors: ThemeColors;
  wheat: { bg: string; fg: string; border: string };
}) {
  const display = useMemo(
    () => describePendingChange(change, resolverCtx),
    [change, resolverCtx]
  );
  const palette = paletteFor(change.kind, colors, wheat);
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
          marginBottom: display.before || display.after ? 8 : 0
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 99,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
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
            {display.title}
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
            {display.typeLabel}
          </Text>
        </View>
      </View>
      {renderDiff(display, colors)}
    </View>
  );
}

function renderDiff(display: DisplayChange, colors: ThemeColors) {
  if (display.before === null && display.after === null) return null;
  return (
    <View style={{ marginLeft: 32, gap: 4 }}>
      {display.before !== null ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 12.5,
            color: colors.ink3,
            letterSpacing: 0.3,
            textDecorationLine:
              display.verb === "Changed" || display.verb === "Removed"
                ? "line-through"
                : "none",
            textDecorationColor: colors.ink4
          }}
        >
          {display.before}
        </Text>
      ) : null}
      {display.after !== null ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono_600SemiBold",
            fontSize: 12.5,
            color: colors.ink2,
            letterSpacing: 0.3
          }}
        >
          {display.after}
        </Text>
      ) : null}
    </View>
  );
}

function paletteFor(
  kind: PendingChange["kind"],
  colors: ThemeColors,
  wheat: { bg: string; fg: string }
) {
  if (kind === "add") {
    return {
      bg: colors.sageBg,
      fg: colors.forest,
      icon: "add" as keyof typeof Ionicons.glyphMap
    };
  }
  if (kind === "change") {
    return {
      bg: wheat.bg,
      fg: wheat.fg,
      icon: "arrow-forward" as keyof typeof Ionicons.glyphMap
    };
  }
  return {
    bg: colors.dangerSoft,
    fg: colors.danger,
    icon: "remove" as keyof typeof Ionicons.glyphMap
  };
}

function HeadsUpCard({
  headsUp,
  colors,
  wheat
}: {
  headsUp: HeadsUp;
  colors: ThemeColors;
  wheat: { bg: string; fg: string; border: string };
}) {
  const warn = headsUp.severity === "warn";
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
        padding: 16,
        borderRadius: 14,
        backgroundColor: warn ? wheat.bg : colors.sageBg,
        borderWidth: 1,
        borderColor: warn ? wheat.border : colors.sageDeep
      }}
    >
      <Ionicons
        name={warn ? "alert-circle-outline" : "sparkles-outline"}
        size={18}
        color={warn ? wheat.fg : colors.forest}
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
          {headsUp.title || "Heads up"}
        </Text>
        <Text
          style={{
            fontFamily: "Geist_400Regular",
            fontSize: 12.5,
            color: colors.ink2,
            lineHeight: 18
          }}
        >
          {headsUp.body}
        </Text>
        {headsUp.suggestedAction ? (
          // R20 spec: render the suggested-action label as visible but
          // non-functional. The action plumb-through (e.g. "Tap to keep
          // medium" overriding an effort tier) is parked for R20.5+.
          <Text
            style={{
              fontFamily: "Geist_500Medium",
              fontSize: 12,
              color: colors.ink3,
              marginTop: 6,
              letterSpacing: -0.05
            }}
          >
            {headsUp.suggestedAction.label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
