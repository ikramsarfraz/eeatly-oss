import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Always evaluate at request time — no static caching of the health check.
export const dynamic = "force-dynamic";

/**
 * Minimal health endpoint for uptime monitors (Vercel, Better Stack, etc).
 * Deliberately does NOT touch the database — a DB outage shouldn't make
 * the health check fail (route returning 200 still means the Next process
 * is alive). For DB-readiness, add a separate `/api/health/db` later if
 * the monitoring setup needs it.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
