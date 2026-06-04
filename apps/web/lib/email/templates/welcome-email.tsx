import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type WelcomeEmailProps = {
  name: string;
  dashboardUrl: string;
  contactEmail?: string;
};

export function WelcomeEmail({ name, dashboardUrl, contactEmail }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview="Welcome to eeatly, your family's food memory"
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>Welcome, {name}</Heading>
        <Text style={emailText}>
          eeatly is a quiet place to keep your family&apos;s food memory: the
          meals worth making again, the recipes worth passing down.
        </Text>
        <Text style={emailText}>
          The easiest way to start: log a meal you cooked recently. Even a
          one-line note (&ldquo;chicken karahi, Sunday&rdquo;) is enough to
          begin the thread.
        </Text>
        <Section style={{ marginTop: "24px" }}>
          <Button href={dashboardUrl} style={emailButton}>
            Log your first meal
          </Button>
        </Section>
        <Text style={{ ...emailText, marginTop: "20px" }}>
          When you&apos;re ready, you can invite family to share a kitchen. No
          rush; eeatly works well solo too.
        </Text>
        <Text style={{ ...emailSmall, marginTop: "16px" }}>
          Direct link if the button doesn&apos;t open:{" "}
          <Link href={dashboardUrl} style={emailLink}>
            {dashboardUrl}
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
