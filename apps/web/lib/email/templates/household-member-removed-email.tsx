import { Heading, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailHeading, emailSmall, emailText } from "./base-styles";

export type HouseholdMemberRemovedEmailProps = {
  name: string;
  householdName: string;
  contactEmail?: string;
};

export function HouseholdMemberRemovedEmail({
  name,
  householdName,
  contactEmail
}: HouseholdMemberRemovedEmailProps) {
  return (
    <EmailLayout
      preview={`You've been removed from ${householdName} on eeatly`}
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>
          You&apos;ve been removed from {householdName}
        </Heading>
        <Text style={emailText}>Hi {name},</Text>
        <Text style={emailText}>
          You no longer have access to the shared cooking memory in{" "}
          <strong>{householdName}</strong>. The next time you sign in to eeatly,
          you&apos;ll land in a fresh personal kitchen.
        </Text>
        <Text style={emailSmall}>
          If you think this is a mistake, reach out to the household owner. We
          don&apos;t share contact info between members for privacy.
        </Text>
      </Section>
    </EmailLayout>
  );
}
