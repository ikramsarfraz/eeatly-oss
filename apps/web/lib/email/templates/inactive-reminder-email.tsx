import { Button, Heading, Link, Section, Text } from "react-email";
import { EmailLayout } from "./email-layout";
import { emailButton, emailHeading, emailLink, emailSmall, emailText } from "./base-styles";

export type InactiveReminderEmailProps = {
  name: string;
  dashboardUrl: string;
  daysQuiet: number | null;
  /** Up to ~3 dish names from this user's neglected/least-recently-cooked
   *  meals. Empty array = the user has logs but we have nothing fresh to
   *  surface (rare); we still send the email but skip the list. */
  neglectedMealNames?: readonly string[];
  contactEmail?: string;
};

export function InactiveReminderEmail({
  name,
  dashboardUrl,
  daysQuiet,
  neglectedMealNames = [],
  contactEmail
}: InactiveReminderEmailProps) {
  const quietLine =
    typeof daysQuiet === "number" && daysQuiet > 0
      ? `It's been about ${daysQuiet} days since you logged a meal.`
      : "It's been a little while since you logged a meal.";

  const hasSuggestions = neglectedMealNames.length > 0;

  return (
    <EmailLayout preview="A few dishes worth bringing back" contactEmail={contactEmail}>
      <Section>
        <Heading style={emailHeading}>Anything good cooking, {name}?</Heading>
        <Text style={emailText}>{quietLine}</Text>
        {hasSuggestions ? (
          <>
            <Text style={emailText}>
              Here are a few dishes from your kitchen that might be worth
              bringing back:
            </Text>
            <Section style={{ margin: "8px 0 12px", paddingLeft: "4px" }}>
              {neglectedMealNames.map((mealName) => (
                <Text
                  key={mealName}
                  style={{ ...emailText, margin: "2px 0", fontWeight: 500 }}
                >
                  · {mealName}
                </Text>
              ))}
            </Section>
          </>
        ) : (
          <Text style={emailText}>
            Even a quick one-line log keeps the thread going — weeknight repeats
            count.
          </Text>
        )}
        <Section style={{ marginTop: "20px" }}>
          <Button href={dashboardUrl} style={emailButton}>
            Open your kitchen
          </Button>
        </Section>
        <Text style={{ ...emailSmall, marginTop: "20px" }}>
          Direct link:{" "}
          <Link href={dashboardUrl} style={emailLink}>
            {dashboardUrl}
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
