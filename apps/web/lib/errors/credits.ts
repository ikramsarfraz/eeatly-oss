/**
 * Thrown when an AI operation can't be paid for out of the user's credit
 * balance. Carries the cost + current balance so the UI can render a precise
 * "you need N more credits — top up or upgrade" prompt.
 */
export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  constructor(
    readonly needed: number,
    readonly balance: number
  ) {
    super(`Insufficient AI credits: need ${needed}, have ${balance}.`);
    this.name = "InsufficientCreditsError";
  }
}
