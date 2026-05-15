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
import { emailBody, emailButton, emailContainer, emailHeading, emailText } from "./base-styles";

export type FirstMealEncouragementEmailProps = {
  name: string;
  dashboardUrl: string;
};

export function FirstMealEncouragementEmail({ name, dashboardUrl }: FirstMealEncouragementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>That&apos;s one meal saved — here&apos;s what to try next</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>That&apos;s one to remember, {name}</Heading>
            <Text style={emailText}>
              Your first meal is in. That&apos;s the hard part — eeatly gets
              more useful the more you add.
            </Text>
            <Text style={emailText}>
              Next time you cook, try the AI suggest button. Snap a photo of
              the dish (or paste a recipe, even record a voice note) and
              we&apos;ll fill in the fields for you.
            </Text>
            <Section style={{ marginTop: "24px" }}>
              <Button href={dashboardUrl} style={emailButton}>
                Open your kitchen
              </Button>
            </Section>
            <Text style={{ ...emailText, marginTop: "20px" }}>
              When you&apos;re ready to share with family — your mom, your
              partner, the cousins in another time zone — you can invite
              them to your kitchen. Their meals show up alongside yours.
            </Text>
            <Text style={{ ...emailText, fontSize: "13px", color: "#4a5246" }}>
              Direct link:{" "}
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
