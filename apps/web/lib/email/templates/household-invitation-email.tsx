import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type HouseholdInvitationEmailProps = {
  inviterName: string;
  householdName: string;
  inviteUrl: string;
  expiresInDays: number;
  contactEmail?: string;
};

export function HouseholdInvitationEmail({
  inviterName,
  householdName,
  inviteUrl,
  expiresInDays,
  contactEmail
}: HouseholdInvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${householdName} on eeatly`}
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>
          {inviterName} invited you to {householdName}
        </Heading>
        <Text style={emailText}>
          eeatly is a shared cooking memory. Accept the invitation to merge your
          meals into <strong>{householdName}</strong>. Recipes you&apos;ve
          already logged will move with you.
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Button href={inviteUrl} style={emailButton}>
            Accept invitation
          </Button>
        </Section>
        <Text style={emailSmall}>
          This invitation expires in {expiresInDays} days. If you didn&apos;t
          expect it, you can ignore this email.
        </Text>
        <Text style={emailSmall}>
          Or paste this link into your browser:{" "}
          <Link href={inviteUrl} style={emailLink}>
            {inviteUrl}
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
