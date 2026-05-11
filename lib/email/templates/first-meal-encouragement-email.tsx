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

export type FirstMealEncouragementEmailProps = {
  name: string;
  dashboardUrl: string;
};

export function FirstMealEncouragementEmail({ name, dashboardUrl }: FirstMealEncouragementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Log your first meal — eeatly gets better with a little history</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>Cook something simple today, {name}</Heading>
            <Text style={emailText}>
              One quick log locks in what you actually eat. Weeknight repeats count.
            </Text>
            <Text style={emailText}>
              Open your dashboard, jot a name plus effort, and you’re set in under a minute.
            </Text>
            <Section style={{ marginTop: "24px" }}>
              <Button href={dashboardUrl} style={emailButton}>
                Open dashboard
              </Button>
            </Section>
            <Text style={{ ...emailText, marginTop: "20px", fontSize: "13px", color: "#4a5246" }}>
              If the button fails, copy this link:{" "}
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
