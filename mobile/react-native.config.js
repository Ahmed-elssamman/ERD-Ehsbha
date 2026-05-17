// Reanimated 3.17 bundles `com.swmansion.worklets.*` internally. The
// standalone `react-native-worklets` package is kept as a JS-only dep so
// nativewind's `react-native-css-interop` babel preset can resolve
// `react-native-worklets/plugin` — but its native Android/iOS code must
// NOT be autolinked, otherwise R8 sees the same classes twice.
module.exports = {
  dependencies: {
    'react-native-worklets': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
