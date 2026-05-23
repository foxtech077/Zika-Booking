const { getDefaultConfig } = require("expo/metro-config");
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

// pnpm resolves expo/AppEntry.js to its real path inside the .pnpm store, so
// the relative ../../App import points into the store instead of the project
// root. Intercept that import and point it to our local _app.js.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force all react and react-native requests to resolve from the mobile node_modules
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return context.resolveRequest(
      {
        ...context,
        originModulePath: path.resolve(projectRoot, "index.js"),
      },
      moduleName,
      platform
    );
  }
  if (moduleName === "react-native" || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      {
        ...context,
        originModulePath: path.resolve(projectRoot, "index.js"),
      },
      moduleName,
      platform
    );
  }
  if (moduleName === "../../App") {
    return {
      filePath: path.resolve(projectRoot, "_app.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
