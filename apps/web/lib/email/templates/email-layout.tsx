import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text
} from "react-email";
import { BRAND, emailBody, emailContainer } from "./base-styles";

export type EmailLayoutProps = {
  /** Inbox preview line (hidden in body). */
  preview: string;
  /** Reply-To contact surfaced in the footer — keeps body branding in sync
   *  with the sender identity (support@, billing@, …). */
  contactEmail?: string;
  /** Optional marketing footer note (e.g. unsubscribe). Transactional mail
   *  leaves this unset. */
  footerNote?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Shared branded shell for every eeatly email: the wordmark header and the
 * footer (contact + tagline) are identical across templates, so each message
 * carries consistent branding regardless of which sender alias it came from.
 *
 * The wordmark is a serif text mark (no hosted image — images get blocked by
 * default in many clients), echoing the in-product Instrument Serif wordmark.
 */
export function EmailLayout({
  preview,
  contactEmail = "support@eeatly.com",
  footerNote,
  children
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailBody}>
        <Container style={emailContainer}>
          <Section style={headerSection}>
            <Text style={wordmark}>eeatly</Text>
          </Section>

          {children}

          <Hr style={footerRule} />
          <Section>
            <Text style={footerText}>
              Questions? Write to{" "}
              <Link href={`mailto:${contactEmail}`} style={footerLink}>
                {contactEmail}
              </Link>
              .
            </Text>
            {footerNote ? <Text style={footerMuted}>{footerNote}</Text> : null}
            <Text style={footerMuted}>
              eeatly — your family&apos;s food memory.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const headerSection = {
  margin: "0 0 24px"
};

const wordmark = {
  fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  fontStyle: "italic" as const,
  fontSize: "30px",
  lineHeight: "1",
  color: BRAND.green,
  margin: "0",
  letterSpacing: "-0.01em"
};

const footerRule = {
  borderColor: BRAND.hairline,
  margin: "32px 0 16px"
};

const footerText = {
  fontSize: "13px",
  lineHeight: "1.55",
  color: BRAND.muted,
  margin: "0 0 6px"
};

const footerLink = {
  color: BRAND.green
};

const footerMuted = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: BRAND.muted,
  margin: "0 0 4px"
};
