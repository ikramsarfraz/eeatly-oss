import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type ConnectionInvitationEmailProps = {
  inviterName: string;
  inviteUrl: string;
  expiresInDays: number;
  contactEmail?: string;
};

/**
 * Per-item sharing model: an invite to join someone's sharing circle.
 * Unlike the household invitation, accepting does NOT move the invitee
 * between households — it just connects them so the inviter can share
 * specific recipes and plans.
 */
export function ConnectionInvitationEmail({
  inviterName,
  inviteUrl,
  expiresInDays,
  contactEmail
}: ConnectionInvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} wants to share recipes with you on eeatly`}
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>
          {inviterName} wants to share with you
        </Heading>
        <Text style={emailText}>
          On eeatly, sharing is private by design. Connecting lets{" "}
          <strong>{inviterName}</strong> share specific recipes and plans with
          you — never their whole library — and anything you share back appears
          in their &ldquo;Shared with you.&rdquo;
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Button href={inviteUrl} style={emailButton}>
            Accept &amp; connect
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
