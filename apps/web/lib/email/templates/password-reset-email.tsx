import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type PasswordResetEmailProps = {
  /** The one-time password-reset URL. */
  url: string;
  contactEmail?: string;
};

export function PasswordResetEmail({ url, contactEmail }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your eeatly password" contactEmail={contactEmail}>
      <Section>
        <Heading style={emailHeading}>Reset your password</Heading>
        <Text style={emailText}>
          We got a request to reset the password for your eeatly account. Tap the
          button below to choose a new one.
        </Text>
        <Section style={{ marginTop: "24px" }}>
          <Button href={url} style={emailButton}>
            Reset password
          </Button>
        </Section>
        <Text style={{ ...emailText, marginTop: "20px" }}>
          This link expires in an hour and can only be used once. If you
          didn&apos;t ask to reset your password, you can safely ignore this
          email. Your password stays the same.
        </Text>
        <Text style={{ ...emailSmall, marginTop: "16px" }}>
          Direct link if the button doesn&apos;t open:{" "}
          <Link href={url} style={emailLink}>
            {url}
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
