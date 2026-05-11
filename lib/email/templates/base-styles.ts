/**
 * Shared eeatly transactional email styles (inline for client compatibility).
 */
export const emailBody = {
  backgroundColor: "#f7f7f2",
  color: "#1f2320",
  fontFamily: "Inter, Arial, sans-serif"
};

export const emailContainer = {
  margin: "0 auto",
  padding: "32px 20px",
  maxWidth: "520px"
};

export const emailHeading = {
  fontSize: "26px",
  lineHeight: "1.25",
  margin: "0 0 14px"
};

export const emailText = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 12px"
};

export const emailButton = {
  display: "inline-block",
  padding: "12px 20px",
  backgroundColor: "#3d4f3a",
  color: "#f7f7f2",
  textDecoration: "none",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "600" as const
};
