// Workspace-root Babel config.
//
// EAS Build invokes Metro/Babel with cwd = monorepo root. Babel's default
// `rootMode: 'root'` looks for `babel.config.js` at cwd; without this file
// it would not find `mobile/babel.config.js`, so the module-resolver alias
// (`@/...` -> `mobile/src/...`) would never run. We re-export the mobile
// config here so Babel picks it up regardless of where it's invoked from.
//
// Backend (NestJS) uses `ts-jest` explicitly and does NOT consult Babel,
// so this file is inert for backend tooling.
module.exports = require('./mobile/babel.config.js');
