// Round 12 — barrel for the gate registry + rule names. The resolver
// stays in `apps/web/lib/gates/resolver.ts` because it touches the DB +
// React.cache (server-only); only the static catalog moves here.
export * from "./registry";
export * from "./rules";
