/**
 * Round 16 — typed errors for the URL preview procedure.
 * Each subclass exposes a literal `code` matching the wire-stable
 * `cause.reason` strings the client UI matches on.
 */

export class UrlInvalidError extends Error {
  readonly code = "URL_INVALID" as const;
  constructor(message?: string) {
    super(message ?? "That doesn't look like a URL we can read.");
    this.name = "UrlInvalidError";
  }
}

export class UrlPrivateNetworkError extends Error {
  readonly code = "URL_PRIVATE_NETWORK" as const;
  constructor(message?: string) {
    super(message ?? "That URL points at a private network.");
    this.name = "UrlPrivateNetworkError";
  }
}

export class UrlFetchFailedError extends Error {
  readonly code = "URL_FETCH_FAILED" as const;
  constructor(message?: string) {
    super(message ?? "Couldn't load that URL right now.");
    this.name = "UrlFetchFailedError";
  }
}

export class UrlTooLargeError extends Error {
  readonly code = "URL_TOO_LARGE" as const;
  constructor() {
    super("That page is too large to preview.");
    this.name = "UrlTooLargeError";
  }
}

export class UrlNoMetadataError extends Error {
  readonly code = "URL_NO_METADATA" as const;
  constructor() {
    super("That page didn't have a preview we could read.");
    this.name = "UrlNoMetadataError";
  }
}

export type UrlPreviewError =
  | UrlInvalidError
  | UrlPrivateNetworkError
  | UrlFetchFailedError
  | UrlTooLargeError
  | UrlNoMetadataError;
