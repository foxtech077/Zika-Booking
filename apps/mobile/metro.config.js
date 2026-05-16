const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can serve files from the pnpm store
config.watchFolders = [monorepoRoot];

// Resolve packages from local node_modules first, then the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Apply NativeWind FIRST so its resolveRequest is set, then we wrap it.
// If we set resolveRequest before withNativeWind, NativeWind overwrites it.
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

// pnpm resolves expo/AppEntry.js to its real path inside the .pnpm store, so
// the relative ../../App import points into the store instead of the project
// root. Wrap NativeWind's resolver so our intercept runs first.
const nativeWindResolve = nativeWindConfig.resolver.resolveRequest;
nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "../../App") {
    return {
      filePath: path.resolve(projectRoot, "_app.js"),
      type: "sourceFile",
    };
  }
  if (nativeWindResolve) {
    return nativeWindResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = nativeWindConfig;
