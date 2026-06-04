import { Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type AccountDeletedEmailProps = {
  name: string;
  /** Where to write if "this wasn't me" — the support Reply-To for this
   *  category, passed in by the dispatcher. Also shown in the footer. */
  contactEmail: string;
};

export function AccountDeletedEmail({ name, contactEmail }: AccountDeletedEmailProps) {
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(
    "I didn't request my eeatly account deletion"
  )}`;
  return (
    <EmailLayout
      preview="Your eeatly account has been deleted"
      contactEmail={contactEmail}
    >
      <Section>
        <Heading style={emailHeading}>Your eeatly account is closed, {name}</Heading>
        <Text style={emailText}>
          We&apos;ve deleted your account and removed your personal data from
          our systems. Recipes you created in your own kitchen are gone with it.
        </Text>
        <Text style={emailText}>
          If you were part of a shared kitchen, the meals you logged there stay
          with the household as &ldquo;Former member&rdquo;, your name and email
          are no longer attached.
        </Text>
        <Text style={emailText}>
          You can sign up again any time with the same email.
        </Text>
        <Text style={{ ...emailText, marginTop: "20px" }}>
          <strong>If this wasn&apos;t you:</strong>{" "}
          <Link href={mailto} style={emailLink}>
            let us know
          </Link>{" "}
          and we&apos;ll look into it.
        </Text>
        <Text style={{ ...emailSmall, marginTop: "20px" }}>
          Thanks for trying eeatly. We hope your kitchen stayed warm while you
          were here.
        </Text>
      </Section>
    </EmailLayout>
  );
}
