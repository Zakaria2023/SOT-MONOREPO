// Metro configuration tuned for this pnpm + Turborepo monorepo.
// Metro must watch the repo root (so shared packages resolve) and be told about
// both the app-local and root `node_modules` folders, since pnpm hoists shared
// deps to the root store.
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
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
