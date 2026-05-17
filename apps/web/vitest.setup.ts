// Round 22.5 — `@testing-library/jest-dom` adds matchers like
// `toBeInTheDocument()`. The /vitest export auto-extends vitest's
// `expect`. Importing has no side effects on Node-env tests since
// the matchers only kick in when DOM-targeting assertions are
// actually called.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this, mounted React trees leak between tests in the same
// file — querying for "absent" text would still match the previous
// test's DOM. testing-library used to auto-register when vitest had
// `globals: true`; vitest 4 dropped the implicit registration, so we
// wire it up explicitly here.
afterEach(() => {
  cleanup();
});

export {};
