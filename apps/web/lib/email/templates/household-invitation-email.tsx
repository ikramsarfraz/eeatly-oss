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

export type HouseholdInvitationEmailProps = {
  inviterName: string;
  householdName: string;
  inviteUrl: string;
  expiresInDays: number;
};

export function HouseholdInvitationEmail({
  inviterName,
  householdName,
  inviteUrl,
  expiresInDays
}: HouseholdInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to {householdName} on eeatly
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Heading style={heading}>
              {inviterName} invited you to {householdName}
            </Heading>
            <Text style={text}>
              eeatly is a shared cooking memory. Accept the invitation to merge
              your meals into <strong>{householdName}</strong> — recipes you&apos;ve
              already logged will move with you.
            </Text>
            <Section style={ctaWrapper}>
              <Button href={inviteUrl} style={cta}>
                Accept invitation
              </Button>
            </Section>
            <Text style={smallText}>
              This invitation expires in {expiresInDays} days. If you
              didn&apos;t expect it, you can ignore this email.
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
