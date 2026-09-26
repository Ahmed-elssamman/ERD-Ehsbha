import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function repoRoot() {
  return resolve(__dirname, '../../..');
}

function workspaceDir(name) {
  return resolve(repoRoot(), 'apps', name);
}

function reportDir() {
  return resolve(repoRoot(), 'verification-output');
}

function coverageDir() {
  return resolve(repoRoot(), 'coverage');
}

function buildDir(workspace) {
  return resolve(workspaceDir(workspace), 'dist');
}

function tempResultDir() {
  return resolve(repoRoot(), 'verification-output', 'tmp');
}

export {
  repoRoot,
  workspaceDir,
  reportDir,
  coverageDir,
  buildDir,
  tempResultDir,
};
