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
} from "@react-email/components";
import { emailBody, emailButton, emailContainer, emailHeading, emailText } from "./base-styles";

export type InactiveReminderEmailProps = {
  name: string;
  dashboardUrl: string;
  daysQuiet: number | null;
};

export function InactiveReminderEmail({ name, dashboardUrl, daysQuiet }: InactiveReminderEmailProps) {
  const quietLine =
    typeof daysQuiet === "number" && daysQuiet > 0
      ? `It has been about ${daysQuiet} days since your last log.`
      : "We noticed you have not logged lately.";

  return (
    <Html>
      <Head />
      <Preview>Your cooking history misses you</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>Missing your kitchen notes, {name}</Heading>
            <Text style={emailText}>{quietLine}</Text>
            <Text style={emailText}>
              CookLoop stays useful when you toss in quick wins — same repeat dinners are perfect.
            </Text>
            <Section style={{ marginTop: "24px" }}>
              <Button href={dashboardUrl} style={emailButton}>
                Log tonight’s meal
              </Button>
            </Section>
            <Text style={{ ...emailText, marginTop: "20px", fontSize: "13px", color: "#4a5246" }}>
              Shortcut link:{" "}
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
