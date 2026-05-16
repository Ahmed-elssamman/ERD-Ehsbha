// Workspace-root entry shim.
//
// EAS Build uploads this monorepo from its root, and on the cloud builder
// `expo export:embed` resolves the entry from the root package.json. The root
// has no `main` field, so it falls back to `node_modules/expo/AppEntry.js`,
// which does `import App from '../../App'` — i.e. this file.
//
// We re-export Expo Router's qualified App component so the registered root is
// identical to what `expo-router/entry` would have rendered. Local dev (run
// from `mobile/`) is unaffected: it still uses `mobile/package.json`'s
// `"main": "expo-router/entry"`.
import { App } from 'expo-router/build/qualified-entry';
export default App;
