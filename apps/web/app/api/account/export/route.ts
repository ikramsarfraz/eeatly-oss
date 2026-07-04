import { NextResponse } from "next/server";
import { desc, eq, isNull, and } from "drizzle-orm";
import { mealLogs, meals } from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { db, withRlsContext } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR-style data export. Returns the user's meal history as CSV — the
 * data they can reasonably want to walk away with. Auth + analytics
 * tables are intentionally excluded (those belong to the system; the
 * user's contribution is the meals + logs).
 *
 * For tiny cohorts a streamed full-table dump is fine. If exports get
 * large, swap to a background job that produces a downloadable URL +
 * emails the link.
 */
export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await withRlsContext(user.id, () =>
      db
        .select({
          mealName: meals.name,
          cookedAt: mealLogs.cookedAt,
          effortLevel: mealLogs.effortLevel,
          notes: mealLogs.notes,
          photoUrl: mealLogs.photoUrl,
          recipeText: meals.recipeText,
          recipeSourceUrl: meals.recipeSourceUrl,
          servings: meals.servings,
          loggedAt: mealLogs.createdAt
        })
        .from(mealLogs)
        .innerJoin(meals, eq(mealLogs.mealId, meals.id))
        .where(and(eq(mealLogs.cookedByUserId, user.id), isNull(mealLogs.deletedAt)))
        .orderBy(desc(mealLogs.cookedAt))
    );

    const csv = toCsv(rows);

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `eeatly-meals-${dateStamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    logger.error("account_export_failed", {
      requestId: (await getRequestId()) ?? undefined,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "Couldn't generate export right now." },
      { status: 500 }
    );
  }
}

const COLUMNS = [
  "meal_name",
  "cooked_at",
  "effort_level",
  "notes",
  "photo_url",
  "recipe_text",
  "recipe_source_url",
  "servings",
  "logged_at"
] as const;

type Row = {
  mealName: string;
  cookedAt: string;
  effortLevel: string;
  notes: string | null;
  photoUrl: string | null;
  recipeText: string | null;
  recipeSourceUrl: string | null;
  servings: string | null;
  loggedAt: Date | string;
};

function toCsv(rows: Row[]): string {
  const header = COLUMNS.join(",");
  const body = rows
    .map((r) =>
      [
        escape(r.mealName),
        escape(r.cookedAt),
        escape(r.effortLevel),
        escape(r.notes ?? ""),
        escape(r.photoUrl ?? ""),
        escape(r.recipeText ?? ""),
        escape(r.recipeSourceUrl ?? ""),
        escape(typeof r.loggedAt === "string" ? r.loggedAt : r.loggedAt.toISOString())
      ].join(",")
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

// RFC 4180 quoting: wrap in double quotes if the value contains a comma,
// newline, or double quote; double up any internal quotes.
function escape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
