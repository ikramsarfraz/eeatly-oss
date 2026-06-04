import { Heading, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailHeading, emailText } from "./base-styles";

export type WeeklyRecapEmailProps = {
  name: string;
  teaserLine: string;
  contactEmail?: string;
};

/**
 * Placeholder scaffold for automated weekly summaries.
 * Scheduling + real metrics wire up later — copy stays intentional and calm.
 */
export function WeeklyRecapEmail({ name, teaserLine, contactEmail }: WeeklyRecapEmailProps) {
  return (
    <EmailLayout preview="Your eeatly recap is almost ready" contactEmail={contactEmail}>
      <Section>
        <Heading style={emailHeading}>{name}, weekly recap incoming</Heading>
        <Text style={emailText}>
          We are prepping a lightweight summary of what you cooked and what
          resurfaced soon.
        </Text>
        <Text style={{ ...emailText, fontWeight: 600 }}>{teaserLine}</Text>
        <Text style={emailText}>
          For now open the dashboard to review recent logs. The recap email
          will reuse that same data once scheduling ships.
        </Text>
      </Section>
    </EmailLayout>
  );
}
