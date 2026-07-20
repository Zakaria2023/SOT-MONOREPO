// Metro configuration tuned for this pnpm + Turborepo monorepo.
//
// Metro must watch the repo root so it can follow pnpm's symlinks into the
// `.pnpm` virtual store, and know about both the app-local and root
// `node_modules`. We deliberately KEEP hierarchical lookup enabled (Metro's
// default): pnpm nests each package's dependencies inside its own virtual-store
// `node_modules`, so a transitive dep like `@expo/metro-runtime` is only found
// by walking up from the importing file — disabling that lookup breaks pnpm.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// The sibling Next.js apps in this monorepo depend on React 19, while Expo 52
// pins React 18.3.1. Because Metro walks up into the shared pnpm store, a bare
// `react`/`react-dom` import from expo-router's static web renderer can resolve
// to the root's React 19 copy instead of this app's 18.3.1. Two React copies
// make `$$typeof` Symbols mismatch, which surfaces as "Objects are not valid as
// a React child (found: object with keys {$$typeof, ...})". Force these three
// packages (and their subpaths) to always resolve to this app's own copy.
const forcedRoots = ["react", "react-dom"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = forcedRoots.find(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  if (forced) {
    const subpath = moduleName.slice(forced.length);
    return context.resolveRequest(
      context,
      path.join(projectRoot, "node_modules", forced) + subpath,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
