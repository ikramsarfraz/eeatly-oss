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

export function WelcomeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to eeatly</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Heading style={heading}>Welcome, {name}</Heading>
            <Text style={text}>
              eeatly is ready to help you remember the meals worth making again.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f7f7f2",
  color: "#1f2320",
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
  margin: "0 0 12px"
};

const text = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0"
};
