import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reuse the same Proxy-mock-db pattern from services/notifications.test.ts.
// Lifecycle-cron mostly delegates to two collaborators (the
// `db.execute` SQL fetch and the notification + email dispatch helpers),
// so we mock those at the boundary rather than chasing every chain.

const cronState = vi.hoisted(() => {
  type ExecuteResult = { rows: unknown[] };
  // Round 9: lifecycle-cron now issues a second `db.execute` per inactive
  // user (the neglected-meal-names lookup). The queue lets tests script
  // multiple shaped responses per run; calls after the queue is empty fall
  // back to `[]` (consistent with the helper's catch-and-empty behavior).
  const queue: ExecuteResult[] = [];

  return {
    setExecuteRows(rows: unknown[]) {
      queue.length = 0;
      queue.push({ rows });
    },
    queueExecuteRows(rows: unknown[]) {
      queue.push({ rows });
    },
    consumeExecuteRows(): ExecuteResult {
      return queue.shift() ?? { rows: [] };
    }
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    execute: vi.fn(async () => cronState.consumeExecuteRows())
  }
}));

const notificationsMock = vi.hoisted(() => ({
  createNotificationIfNotRecent: vi.fn()
}));
vi.mock("@/services/notifications", () => notificationsMock);

const emailMock = vi.hoisted(() => ({
  dispatchTransactionalEmail: vi.fn()
}));
vi.mock("@/lib/email/transactional", () => emailMock);

import { runLifecycleNudges } from "./lifecycle-cron";

beforeEach(() => {
  cronState.setExecuteRows([]);
  notificationsMock.createNotificationIfNotRecent.mockReset();
  emailMock.dispatchTransactionalEmail.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function inactiveRow(overrides: Partial<{
  user_id: string;
  email: string;
  name: string;
  last_meal_at: Date | null;
  meal_count: number;
}> = {}) {
  return {
    user_id: overrides.user_id ?? "u-1",
    email: overrides.email ?? "user@example.com",
    name: overrides.name ?? "Pat",
    last_meal_at: overrides.last_meal_at ?? new Date("2026-04-01T00:00:00Z"),
    meal_count: overrides.meal_count ?? 5
  };
}

describe("runLifecycleNudges", () => {
  it("returns zero counts when no inactive users", async () => {
    cronState.setExecuteRows([]);
    const result = await runLifecycleNudges();
    expect(result).toEqual({ scanned: 0, notifiedInactive: 0, emailed: 0, errors: 0 });
    expect(notificationsMock.createNotificationIfNotRecent).not.toHaveBeenCalled();
    expect(emailMock.dispatchTransactionalEmail).not.toHaveBeenCalled();
  });

  it("creates a notification and dispatches an email per inactive user", async () => {
    cronState.setExecuteRows([inactiveRow()]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: false });

    const result = await runLifecycleNudges();
    expect(result.scanned).toBe(1);
    expect(result.notifiedInactive).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.errors).toBe(0);

    expect(notificationsMock.createNotificationIfNotRecent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        type: "neglected_meal",
        href: "/ideas"
      }),
      expect.any(Number)
    );
    expect(emailMock.dispatchTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "inactive_reminder",
        toEmail: "user@example.com",
        userId: "u-1"
      })
    );
  });

  it("skips email when the notification dedup hits", async () => {
    cronState.setExecuteRows([inactiveRow()]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce(null);

    const result = await runLifecycleNudges();
    expect(result.notifiedInactive).toBe(0);
    expect(result.emailed).toBe(0);
    expect(emailMock.dispatchTransactionalEmail).not.toHaveBeenCalled();
  });

  it("counts emailed=0 when transactional email reports skipped (env missing)", async () => {
    cronState.setExecuteRows([inactiveRow()]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: true });

    const result = await runLifecycleNudges();
    expect(result.notifiedInactive).toBe(1);
    expect(result.emailed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("increments errors when notification create throws and continues to next user", async () => {
    cronState.setExecuteRows([
      inactiveRow({ user_id: "u-1" }),
      inactiveRow({ user_id: "u-2" })
    ]);
    notificationsMock.createNotificationIfNotRecent
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ id: "n-2" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: false });

    const result = await runLifecycleNudges();
    expect(result.scanned).toBe(2);
    expect(result.notifiedInactive).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("doesn't fail the run if the email throws after notification succeeds", async () => {
    cronState.setExecuteRows([inactiveRow()]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockRejectedValueOnce(new Error("resend boom"));

    const result = await runLifecycleNudges();
    expect(result.notifiedInactive).toBe(1);
    expect(result.emailed).toBe(0);
    expect(result.errors).toBe(1);
  });

  it("passes daysQuiet derived from last_meal_at into the email dispatch", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    cronState.setExecuteRows([inactiveRow({ last_meal_at: fortyDaysAgo })]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: false });

    await runLifecycleNudges();
    const call = emailMock.dispatchTransactionalEmail.mock.calls[0]?.[0];
    expect(call?.daysQuiet).toBeGreaterThanOrEqual(40);
  });

  it("forwards neglectedMealNames from the per-user lookup into the email dispatch", async () => {
    // First db.execute: the inactive-users scan.
    cronState.setExecuteRows([inactiveRow()]);
    // Second db.execute: the per-user neglected meals lookup.
    cronState.queueExecuteRows([
      { meal_name: "Chicken karahi" },
      { meal_name: "Daal chawal" },
      { meal_name: "Aloo gosht" }
    ]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: false });

    await runLifecycleNudges();
    const call = emailMock.dispatchTransactionalEmail.mock.calls[0]?.[0];
    expect(call?.neglectedMealNames).toEqual([
      "Chicken karahi",
      "Daal chawal",
      "Aloo gosht"
    ]);
  });

  it("still dispatches the email when the neglected-meals lookup returns nothing", async () => {
    cronState.setExecuteRows([inactiveRow()]);
    // Empty result for the per-user lookup — the template gracefully
    // degrades to the general "log a meal" copy.
    cronState.queueExecuteRows([]);
    notificationsMock.createNotificationIfNotRecent.mockResolvedValueOnce({ id: "n-1" });
    emailMock.dispatchTransactionalEmail.mockResolvedValueOnce({ skipped: false });

    const result = await runLifecycleNudges();
    expect(result.emailed).toBe(1);
    const call = emailMock.dispatchTransactionalEmail.mock.calls[0]?.[0];
    expect(call?.neglectedMealNames).toEqual([]);
  });
});
