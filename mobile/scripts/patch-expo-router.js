#!/usr/bin/env node
// Patches expo-router's `_ctx.*.js` files so that `require.context()`
// receives a literal path metro can resolve, instead of `process.env.EXPO_ROUTER_APP_ROOT`.
//
// Why: in npm workspaces / monorepos, babel-preset-expo's auto-detection of
// the app root fails, and metro on Windows mis-resolves absolute paths inside
// require.context. The most reliable fix is to write the path directly into
// the `_ctx.*.js` files as a path that's relative to the file's location.
//
// This script runs as a postinstall step so any reinstall keeps it consistent.

const fs = require('fs');
const path = require('path');

function findExpoRouter(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'node_modules', 'expo-router');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function patchOne(filePath, literal) {
  if (!fs.existsSync(filePath)) return false;
  const src = fs.readFileSync(filePath, 'utf8');
  let patched = src.replace(
    /process\.env\.EXPO_ROUTER_APP_ROOT/g,
    JSON.stringify(literal),
  );
  patched = patched.replace(
    /process\.env\.EXPO_ROUTER_IMPORT_MODE/g,
    JSON.stringify('sync'),
  );
  if (patched === src) return false;
  fs.writeFileSync(filePath, patched, 'utf8');
  return true;
}

function run() {
  const mobileDir = path.resolve(__dirname, '..');
  const appDir = path.join(mobileDir, 'app');

  const expoRouterDir = findExpoRouter(mobileDir);
  if (!expoRouterDir) {
    console.error('[patch-expo-router] expo-router not found in node_modules');
    process.exit(0);
  }

  // Compute the path from expo-router/ to mobile/app/, then normalize to forward slashes.
  let rel = path.relative(expoRouterDir, appDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;

  const targets = ['_ctx.android.js', '_ctx.ios.js', '_ctx.web.js', '_ctx.js'];
  let touched = 0;
  for (const file of targets) {
    if (patchOne(path.join(expoRouterDir, file), rel)) {
      touched++;
      console.log(`[patch-expo-router] patched ${file} → "${rel}"`);
    }
  }
  if (touched === 0) {
    console.log('[patch-expo-router] nothing to patch (already patched or missing files)');
  }
}

run();
