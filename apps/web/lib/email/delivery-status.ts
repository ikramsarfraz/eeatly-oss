/** Stronger statuses win when merging webhook + API timelines (ordering matters). */
const DELIVERY_STATUS_ORDER = [
  "pending",
  "delayed",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "complained",
  "bounced",
  "failed",
  "suppressed"
] as const;

export type EmailDeliveryStatus = (typeof DELIVERY_STATUS_ORDER)[number];

const RANK = new Map<string, number>(
  DELIVERY_STATUS_ORDER.map((status, index) => [status, index])
);

export function pickStrongerDeliveryStatus(
  existing: EmailDeliveryStatus,
  incoming: EmailDeliveryStatus
): EmailDeliveryStatus {
  const left = RANK.get(existing) ?? -1;
  const right = RANK.get(incoming) ?? -1;
  return right >= left ? incoming : existing;
}
