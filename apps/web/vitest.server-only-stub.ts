// Aliased in vitest.config.ts as the resolution target for `server-only`.
// Real package throws on import outside a server component context; tests
// run in plain Node and need a no-op replacement.
export {};
