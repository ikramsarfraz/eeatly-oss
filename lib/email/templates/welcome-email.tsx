import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text
} from "react-email";
import {
  emailBody,
  emailButton,
  emailContainer,
  emailHeading,
  emailText
} from "./base-styles";

export type WelcomeEmailProps = {
  name: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to eeatly — your family&apos;s food memory</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>Welcome, {name}</Heading>
            <Text style={emailText}>
              eeatly is a quiet place to keep your family&apos;s food memory —
              the meals worth making again, the recipes worth passing down.
            </Text>
            <Text style={emailText}>
              The easiest way to start: log a meal you cooked recently. Even
              a one-line note (&ldquo;chicken karahi, Sunday&rdquo;) is enough
              to begin the thread.
            </Text>
            <Section style={{ marginTop: "24px" }}>
              <Button href={dashboardUrl} style={emailButton}>
                Log your first meal
              </Button>
            </Section>
            <Text style={{ ...emailText, marginTop: "20px" }}>
              When you&apos;re ready, you can invite family to share a kitchen.
              No rush — eeatly works well solo too.
            </Text>
            <Text style={{ ...emailText, fontSize: "13px", color: "#4a5246" }}>
              Direct link if the button doesn&apos;t open:{" "}
              <Link href={dashboardUrl} style={{ color: "#3d4f3a" }}>
                {dashboardUrl}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
