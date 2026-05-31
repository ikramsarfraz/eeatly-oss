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

export type ConnectionInvitationEmailProps = {
  inviterName: string;
  inviteUrl: string;
  expiresInDays: number;
};

/**
 * Per-item sharing model: an invite to join someone's sharing circle.
 * Unlike the household invitation, accepting does NOT move the invitee
 * between households — it just connects them so the inviter can share
 * specific recipes and plans.
 */
export function ConnectionInvitationEmail({
  inviterName,
  inviteUrl,
  expiresInDays
}: ConnectionInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} wants to share recipes with you on eeatly</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Heading style={heading}>
              {inviterName} wants to share with you
            </Heading>
            <Text style={text}>
              On eeatly, sharing is private by design. Connecting lets{" "}
              <strong>{inviterName}</strong> share specific recipes and plans with you —
              never their whole library — and anything you share back appears in their
              &ldquo;Shared with you.&rdquo;
            </Text>
            <Section style={ctaWrapper}>
              <Button href={inviteUrl} style={cta}>
                Accept &amp; connect
              </Button>
            </Section>
            <Text style={smallText}>
              This invitation expires in {expiresInDays} days. If you didn&apos;t expect
              it, you can ignore this email.
            </Text>
            <Text style={smallText}>
              Or paste this link into your browser:{" "}
              <Link href={inviteUrl} style={fallbackLink}>
                {inviteUrl}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f7f5ee",
  color: "#1b2220",
  fontFamily: "Inter, Arial, sans-serif"
};

const container = {
  margin: "0 auto",
  padding: "32px 20px",
  maxWidth: "520px"
};

const heading = {
  fontSize: "28px",
  lineHeight: "1.2",
  margin: "0 0 16px"
};

const text = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px"
};

const ctaWrapper = {
  margin: "24px 0"
};

const cta = {
  backgroundColor: "#2f6f58",
  color: "#f9fffb",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 500,
  fontSize: "14px",
  display: "inline-block"
};

const smallText = {
  fontSize: "12.5px",
  lineHeight: "1.55",
  color: "#6b746e",
  margin: "0 0 8px",
  wordBreak: "break-all" as const
};

const fallbackLink = {
  color: "#2f6f58"
};
