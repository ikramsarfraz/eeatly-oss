import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Round 9 — tier-2 smoke for the transactional dispatcher's switch
 * arms. We mock the env, the Resend client, and the analytics surface,
 * then assert each template lands at the right Resend.emails.send call
 * with the right subject and the right React component. We're not
 * asserting on the rendered HTML — that's the template's own
 * responsibility and react-email handles it.
 */

const sendMock = vi.hoisted(() =>
  vi.fn<(args: unknown) => Promise<{ error: null; data: { id: string } }>>(async () => ({
    error: null,
    data: { id: "msg_test" }
  }))
);

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    EMAIL_FROM: "no-reply@eeatly.test",
    NEXT_PUBLIC_APP_URL: "https://eeatly.test"
  }),
  hasGoogleAuthEnv: () => false
}));

vi.mock("@/lib/email/resend-client", () => ({
  getResendClient: () => ({ emails: { send: sendMock } })
}));

vi.mock("@/lib/email/delivery-log", () => ({
  logEmailDelivery: vi.fn()
}));

vi.mock("@/services/email-delivery", () => ({
  eeatlyEmailTags: (input: { template: string; userId?: string }) => [
    { name: "template", value: input.template }
  ],
  recordOutboundEmailFromApiSend: vi.fn(async () => undefined)
}));

vi.mock("@/lib/observability/analytics", () => ({
  trackEvent: vi.fn()
}));

import { dispatchTransactionalEmail } from "./transactional";
import { AccountDeletedEmail } from "./templates/account-deleted-email";
import { InactiveReminderEmail } from "./templates/inactive-reminder-email";
import { WelcomeEmail } from "./templates/welcome-email";

beforeEach(() => {
  sendMock.mockClear();
});

describe("dispatchTransactionalEmail — Round 9 templates", () => {
  it("sends the account_deleted template with the right subject + React element", async () => {
    const result = await dispatchTransactionalEmail({
      template: "account_deleted",
      toEmail: "mom@example.com",
      toName: "Sara",
      userId: "u-1"
    });
    expect(result.skipped).toBe(false);
    expect(sendMock).toHaveBeenCalledOnce();
    const call = sendMock.mock.calls[0]?.[0] as {
      subject: string;
      react: { type: unknown; props: { name: string; contactEmail: string } };
      to: string;
      from: string;
    };
    expect(call.subject).toBe("Your eeatly account has been deleted");
    expect(call.to).toBe("mom@example.com");
    expect(call.from).toBe("no-reply@eeatly.test");
    expect(call.react.type).toBe(AccountDeletedEmail);
    expect(call.react.props.name).toBe("Sara");
    expect(call.react.props.contactEmail).toBe("no-reply@eeatly.test");
  });

  it("welcome template now receives dashboardUrl from NEXT_PUBLIC_APP_URL", async () => {
    await dispatchTransactionalEmail({
      template: "welcome",
      toEmail: "new@example.com",
      toName: "Pat",
      userId: "u-2"
    });
    const call = sendMock.mock.calls[0]?.[0] as {
      react: { type: unknown; props: { name: string; dashboardUrl: string } };
    };
    expect(call.react.type).toBe(WelcomeEmail);
    expect(call.react.props.dashboardUrl).toBe("https://eeatly.test/dashboard");
  });

  it("inactive_reminder forwards neglectedMealNames into the template props", async () => {
    await dispatchTransactionalEmail({
      template: "inactive_reminder",
      toEmail: "user@example.com",
      toName: "Pat",
      userId: "u-3",
      daysQuiet: 14,
      neglectedMealNames: ["Chicken karahi", "Daal chawal"]
    });
    const call = sendMock.mock.calls[0]?.[0] as {
      react: {
        type: unknown;
        props: { neglectedMealNames: readonly string[]; daysQuiet: number };
      };
    };
    expect(call.react.type).toBe(InactiveReminderEmail);
    expect(call.react.props.neglectedMealNames).toEqual([
      "Chicken karahi",
      "Daal chawal"
    ]);
    expect(call.react.props.daysQuiet).toBe(14);
  });

  it("inactive_reminder defaults neglectedMealNames to [] when omitted", async () => {
    await dispatchTransactionalEmail({
      template: "inactive_reminder",
      toEmail: "user@example.com",
      toName: "Pat",
      userId: "u-4",
      daysQuiet: null
    });
    const call = sendMock.mock.calls[0]?.[0] as {
      react: { props: { neglectedMealNames: readonly string[] } };
    };
    expect(call.react.props.neglectedMealNames).toEqual([]);
  });
});
