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

module.exports = config;
