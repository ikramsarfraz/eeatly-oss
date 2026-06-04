import { Button, Heading, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailSmall, emailText } from "./base-styles";

export type ComplimentaryAccessEmailProps = {
  name: string;
  /** How many days of access were just granted. */
  days: number;
  /** Human label for when the access runs out, e.g. "June 18, 2026". */
  accessUntilLabel: string;
  dashboardUrl: string;
  /** Support Reply-To for this category, shown in the footer. */
  contactEmail: string;
};

export function ComplimentaryAccessEmail({
  name,
  days,
  accessUntilLabel,
  dashboardUrl,
  contactEmail
}: ComplimentaryAccessEmailProps) {
  const dayLabel = `${days} ${days === 1 ? "day" : "days"}`;
  return (
    <EmailLayout
      preview={`You've got ${dayLabel} of Master Chef access on us`}
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>Enjoy {dayLabel} on us, {name}</Heading>
        <Text style={emailText}>
          We&apos;ve unlocked full <strong>Master Chef</strong> access on your eeatly
          account, no card needed. You&apos;ve got every feature: shared kitchens, meal
          planning, co-editing, priority AI, and a generous monthly credit grant.
        </Text>
        <Text style={emailText}>
          Your complimentary access runs through <strong>{accessUntilLabel}</strong>.
          Cook as much as you like until then, and your library stays yours either way.
        </Text>
        <Section style={{ marginTop: "24px", marginBottom: "8px" }}>
          <Button href={dashboardUrl} style={emailButton}>
            Open your kitchen
          </Button>
        </Section>
        <Text style={{ ...emailSmall, marginTop: "20px" }}>
          Happy cooking. We&apos;d love to hear what you make.
        </Text>
      </Section>
    </EmailLayout>
  );
}
