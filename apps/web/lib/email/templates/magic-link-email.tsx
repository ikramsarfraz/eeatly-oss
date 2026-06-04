import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type MagicLinkEmailProps = {
  /** The one-tap sign-in URL. */
  url: string;
  contactEmail?: string;
};

export function MagicLinkEmail({ url, contactEmail }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your eeatly sign-in link" contactEmail={contactEmail}>
      <Section>
        <Heading style={emailHeading}>Sign in to eeatly</Heading>
        <Text style={emailText}>
          Tap the button below to sign in. No password needed. This link signs
          you straight in.
        </Text>
        <Section style={{ marginTop: "24px" }}>
          <Button href={url} style={emailButton}>
            Sign in to eeatly
          </Button>
        </Section>
        <Text style={{ ...emailText, marginTop: "20px" }}>
          This link expires soon and can only be used once. If you didn&apos;t
          request it, you can safely ignore this email.
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
