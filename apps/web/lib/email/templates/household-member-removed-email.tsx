import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from "react-email";

export type HouseholdMemberRemovedEmailProps = {
  name: string;
  householdName: string;
};

export function HouseholdMemberRemovedEmail({
  name,
  householdName
}: HouseholdMemberRemovedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been removed from {householdName} on eeatly</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Heading style={heading}>
              You&apos;ve been removed from {householdName}
            </Heading>
            <Text style={text}>Hi {name},</Text>
            <Text style={text}>
              You no longer have access to the shared cooking memory in{" "}
              <strong>{householdName}</strong>. The next time you sign in to
              eeatly, you&apos;ll land in a fresh personal kitchen.
            </Text>
            <Text style={smallText}>
              If you think this is a mistake, reach out to the household owner.
              We don&apos;t share contact info between members for privacy.
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
  fontSize: "26px",
  lineHeight: "1.2",
  margin: "0 0 16px"
};

const text = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px"
};

const smallText = {
  fontSize: "12.5px",
  lineHeight: "1.55",
  color: "#6b746e",
  margin: "12px 0 0"
};
