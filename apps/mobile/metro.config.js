// Round 12 — Metro bundler config for the monorepo.
//
// pnpm workspaces install dependencies in a deeply-nested `.pnpm` tree
// under the WORKSPACE root, but Metro's default resolver only walks
// from the mobile app's own `node_modules`. Without this config the
// app can't see `@eeatly/api` (workspace dep) OR any of the regular
// React Native packages that pnpm hoisted to the workspace root.
//
// Pattern follows https://docs.expo.dev/guides/monorepos/ —
//   1. Watch `workspaceRoot` so Metro hot-reloads on changes to
//      packages/api or packages/shared.
//   2. Add both `node_modules` paths to `nodeModulesPaths` so module
//      resolution looks at the mobile-local store AND the workspace
//      root's hoisted store.
//   3. Force Metro to resolve a single React + React Native instance
//      (otherwise pnpm's symlinking can produce duplicate copies and
//      a "two Reacts" runtime error).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];

// Keep hierarchical lookup enabled. pnpm symlinks workspace deps into
// `.pnpm/<pkg>@.../node_modules/<pkg>`, and each `<pkg>` has its own
// sibling `node_modules` with its transitive deps. The upward walk is
// what lets Metro find e.g. whatwg-fetch (a transitive of
// @expo/metro-runtime) from inside the source file that imports it.
config.resolver.disableHierarchicalLookup = false;

// pnpm symlinks workspace deps into ~/Library/pnpm/store/...; `watchman
// watch-project` follows those symlinks and registers each store path as
// its own root, producing thousands of independent watches and 60s+ query
// timeouts on the initial crawl. Use Metro's node crawler instead.
config.resolver.useWatchman = false;

module.exports = config;
