/**
 * Round 6 — Stripe billing-flow errors with stable `.code` discriminators
 * that actions translate into discriminated-union results.
 */

export class BillingNotConfiguredError extends Error {
  readonly code = "BILLING_NOT_CONFIGURED" as const;
  constructor() {
    super("Billing isn't configured for this environment.");
    this.name = "BillingNotConfiguredError";
  }
}

export class NoStripeCustomerError extends Error {
  readonly code = "NO_STRIPE_CUSTOMER" as const;
  constructor() {
    super(
      "No subscription to manage yet — start a checkout to create a Stripe customer first."
    );
    this.name = "NoStripeCustomerError";
  }
}
