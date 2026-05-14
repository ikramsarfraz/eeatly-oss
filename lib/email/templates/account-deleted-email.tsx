import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text
} from "react-email";
import { emailBody, emailContainer, emailHeading, emailText } from "./base-styles";

export type AccountDeletedEmailProps = {
  name: string;
  /** Where to write if "this wasn't me" — typically a mailto: link to
   *  support@eeatly.app, surfaced via EMAIL_FROM or a dedicated env. */
  contactEmail: string;
};

export function AccountDeletedEmail({ name, contactEmail }: AccountDeletedEmailProps) {
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(
    "I didn't request my eeatly account deletion"
  )}`;
  return (
    <Html>
      <Head />
      <Preview>Your eeatly account has been deleted</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>Your eeatly account is closed, {name}</Heading>
            <Text style={emailText}>
              We&apos;ve deleted your account and removed your personal data
              from our systems. Recipes you created in your own kitchen are
              gone with it.
            </Text>
            <Text style={emailText}>
              If you were part of a shared kitchen, the meals you logged
              there stay with the household as &ldquo;Former member&rdquo; —
              your name and email are no longer attached.
            </Text>
            <Text style={emailText}>
              You can sign up again any time with the same email.
            </Text>
            <Text style={{ ...emailText, marginTop: "20px" }}>
              <strong>If this wasn&apos;t you:</strong>{" "}
              <Link href={mailto} style={{ color: "#3d4f3a" }}>
                let us know
              </Link>{" "}
              and we&apos;ll look into it.
            </Text>
            <Text style={{ ...emailText, fontSize: "13px", color: "#4a5246", marginTop: "20px" }}>
              Thanks for trying eeatly — we hope your kitchen stayed warm
              while you were here.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
