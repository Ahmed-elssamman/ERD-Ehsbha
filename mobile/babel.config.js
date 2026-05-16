// Note: the EXPO_ROUTER_APP_ROOT problem is handled by scripts/patch-expo-router.js
// which rewrites the literal path into node_modules/expo-router/_ctx.*.js. We don't
// need an inline babel plugin here anymore.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Resolve `@/...` -> `mobile/src/...` at babel time so the alias works
      // even when the cloud bundler invokes Metro with cwd = monorepo root
      // (where mobile/tsconfig.json is not loaded). Local dev is unaffected.
      ['module-resolver', {
        // `cwd` pins the base for `root`/`alias` paths to this folder
        // (mobile/). Without it, the plugin uses process.cwd() and computes
        // the wrong relative path when Metro is invoked from the monorepo root.
        cwd: __dirname,
        root: [__dirname],
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      }],
      // react-native-reanimated/plugin must remain LAST.
      'react-native-reanimated/plugin',
    ],
  };
};
