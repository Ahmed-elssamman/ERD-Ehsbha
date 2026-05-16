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
      'react-native-reanimated/plugin',
    ],
  };
};
