import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from "@react-email/components";
import { emailBody, emailContainer, emailHeading, emailText } from "./base-styles";

export type WeeklyRecapEmailProps = {
  name: string;
  teaserLine: string;
};

/**
 * Placeholder scaffold for automated weekly summaries.
 * Scheduling + real metrics wire up later — copy stays intentional and calm.
 */
export function WeeklyRecapEmail({ name, teaserLine }: WeeklyRecapEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your eeatly recap is almost ready</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section>
            <Heading style={emailHeading}>{name}, weekly recap incoming</Heading>
            <Text style={emailText}>
              We are prepping a lightweight summary of what you cooked and what resurfaced soon.
            </Text>
            <Text style={{ ...emailText, fontWeight: 600 }}>{teaserLine}</Text>
            <Text style={emailText}>
              For now open the dashboard to review recent logs — the recap email will reuse that same
              data once scheduling ships.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
