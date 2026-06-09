import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { extname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { repoRoot } from './lib/paths.mjs';
import { extractAdminRouterPath, extractRoutes, extractWebRouterPath } from './lib/extract-routes.mjs';
import { validateCoverageRecords } from './lib/validate-coverage-record.mjs';
import { extractApiEndpoints } from './lib/extract-api-endpoints.mjs';
import http from 'http';

const OWNER = 'Phase 0';
const NONE = 'none';

function repositoryPath(path) {
  return relative(repoRoot(), path).replace(/\\/g, '/');
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function resolveSourceModule(surface, modulePath) {
  if (!modulePath || !modulePath.startsWith('@/')) return null;
  const basePath = resolve(repoRoot(), `apps/${surface}/src`, modulePath.slice(2));
  for (const suffix of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveDocumentedPage(pagePath) {
  const basePath = resolve(repoRoot(), pagePath);
  for (const suffix of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export function parseAdminServiceMap(content) {
  const records = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Page')) continue;
    const columns = line.slice(1, -1).split('|').map((value) => value.trim());
    if (columns.length !== 10) continue;
    const [page, route, activity, apiMethod, endpoint, permission, dataSource, status, owner, followUp] = columns;
    records.set(route, {
      page,
      route,
      activity,
      apiMethod,
      endpoint,
      permission,
      dataSource,
      status,
      owner,
      followUp,
    });
  }
  return records;
}

function loadAdminServiceMap(mapPath) {
  if (!existsSync(mapPath)) throw new Error(`Admin service map is missing: ${repositoryPath(mapPath)}`);
  return parseAdminServiceMap(readFileSync(mapPath, 'utf-8'));
}

function coverageRecord({
  surface,
  kind,
  identifier,
  activity = 'active',
  status = 'passed',
  evidence,
  errors = [],
  owner = OWNER,
  followUp = NONE,
}) {
  const failed = errors.length > 0;
  return {
    surface,
    kind,
    identifier,
    activity,
    status: failed ? 'failed' : status,
    evidence,
    blocking: failed && activity === 'active',
    owner,
    followUp,
    blockingErrors: errors,
  };
}

function routeIdentifier(route) {
  if (route.isIndex) return `${route.path}#index`;
  if (route.isCatchAll) return `${route.path}#line-${route.line}`;
  return route.path;
}

function sourceSignals(sourcePath) {
  if (!sourcePath) return { translation: false, empty: false, error: false };
  const content = readFileSync(sourcePath, 'utf-8');
  return {
    translation: /\buseI18n\b|\bt\s*\(/.test(content),
    empty: /\bempty\b|length\s*===?\s*0|!\s*data\b|no results|no data/i.test(content),
    error: /\berror\b|\bisError\b|ErrorBoundary|readApiError/i.test(content),
  };
}

function addPageObservationRecords(records, surface, identifier, sourcePath, activity, owner, followUp) {
  const evidence = sourcePath ? repositoryPath(sourcePath) : 'module resolution failed';
  const signals = sourceSignals(sourcePath);
  records.push(coverageRecord({
    surface,
    kind: 'translation',
    identifier,
    activity,
    status: signals.translation ? 'passed' : 'known_gap',
    evidence: signals.translation ? `${evidence}: uses repository i18n API` : `${evidence}: no static i18n usage found`,
    owner,
    followUp: signals.translation ? NONE : followUp,
  }));
  records.push(coverageRecord({
    surface,
    kind: 'empty-state',
    identifier,
    activity,
    status: signals.empty ? 'passed' : 'known_gap',
    evidence: signals.empty ? `${evidence}: static empty-state branch found` : `${evidence}: no static empty-state branch found`,
    owner,
    followUp: signals.empty ? NONE : followUp,
  }));
  records.push(coverageRecord({
    surface,
    kind: 'error-state',
    identifier,
    activity,
    status: signals.error ? 'passed' : 'known_gap',
    evidence: signals.error ? `${evidence}: static error-state branch found` : `${evidence}: no static error-state branch found`,
    owner,
    followUp: signals.error ? NONE : followUp,
  }));
}

function currentBuildEvidence(surface) {
  const indexPath = resolve(repoRoot(), `apps/${surface}/dist/index.html`);
  const runStartedAt = process.env.VERIFICATION_RUN_STARTED_AT;
  if (!existsSync(indexPath)) {
    return { valid: false, evidence: `${repositoryPath(indexPath)} is missing` };
  }
  if (runStartedAt && statSync(indexPath).mtimeMs < Date.parse(runStartedAt)) {
    return { valid: false, evidence: `${repositoryPath(indexPath)} predates the current run` };
  }
  return {
    valid: true,
    evidence: `${repositoryPath(indexPath)} modified ${statSync(indexPath).mtime.toISOString()}`,
  };
}

function buildRouteCoverage(surface, extraction, serviceMap, buildEvidence) {
  const records = [];

  for (const route of extraction.routes) {
    const identifier = routeIdentifier(route);
    const activity = route.isCatchAll || route.isRedirect ? 'obsolete' : 'active';
    const moduleSource = resolveSourceModule(surface, route.modulePath);
    const isPageModule = Boolean(route.modulePath?.includes('/pages/'));
    const mapEntry = surface === 'admin' && !route.isCatchAll && isPageModule
      ? serviceMap.get(route.isIndex ? route.path : route.path)
      : null;
    const errors = [];

    if (route.isDuplicate) errors.push(`Duplicate sibling route path: ${route.path}`);
    if (!buildEvidence.valid) errors.push(buildEvidence.evidence);
    if (!route.isRedirect && route.component && route.modulePath && !moduleSource) {
      errors.push(`Referenced module does not exist: ${route.modulePath}`);
    }
    if (!route.isRedirect && !route.component) errors.push('Route component metadata is missing');
    if (surface === 'admin' && activity === 'active' && isPageModule && !mapEntry) {
      errors.push(`Admin service mapping is missing for ${route.path}`);
    }

    const knownGap = mapEntry?.status === 'known_gap';
    records.push(coverageRecord({
      surface,
      kind: 'route',
      identifier,
      activity: knownGap ? 'scaffold' : activity,
      status: knownGap ? 'known_gap' : 'passed',
      evidence: `${repositoryPath(extraction.sourceFile)}:${route.line}; ${buildEvidence.evidence}`,
      errors,
      owner: mapEntry?.owner || OWNER,
      followUp: knownGap ? mapEntry.followUp : NONE,
    }));

    if (route.isRedirect || !isPageModule) continue;

    records.push(coverageRecord({
      surface,
      kind: 'page',
      identifier,
      activity: knownGap ? 'scaffold' : activity,
      status: knownGap ? 'known_gap' : 'passed',
      evidence: moduleSource ? repositoryPath(moduleSource) : `${repositoryPath(extraction.sourceFile)}:${route.line}`,
      errors: moduleSource ? [] : [`Page source could not be resolved for ${route.component || identifier}`],
      owner: mapEntry?.owner || OWNER,
      followUp: knownGap ? mapEntry.followUp : NONE,
    }));

    addPageObservationRecords(
      records,
      surface,
      identifier,
      moduleSource,
      knownGap ? 'scaffold' : activity,
      mapEntry?.owner || OWNER,
      mapEntry?.followUp || `Review ${identifier} in a browser coverage phase`,
    );

    if (surface !== 'admin') continue;

    const permissionErrors = [];
    const expectedPermission = mapEntry?.permission;
    if (!expectedPermission) permissionErrors.push('Permission mapping is missing');
    if (expectedPermission !== 'unrestricted' && route.permission !== expectedPermission) {
      permissionErrors.push(`Router permission '${route.permission || 'missing'}' does not match '${expectedPermission}'`);
    }
    records.push(coverageRecord({
      surface,
      kind: 'permission',
      identifier,
      activity: knownGap ? 'scaffold' : activity,
      status: knownGap ? 'known_gap' : 'passed',
      evidence: `${repositoryPath(extraction.sourceFile)}:${route.line}; expected ${expectedPermission || 'missing'}`,
      errors: permissionErrors,
      owner: mapEntry?.owner || OWNER,
      followUp: knownGap ? mapEntry.followUp : NONE,
    }));
  }

  return records;
}

function buildAdminServiceCoverage(serviceMap, apiEndpoints) {
  const records = [];
  const adminSourceFiles = walkFiles(resolve(repoRoot(), 'apps/admin/src'))
    .filter((path) => ['.ts', '.tsx'].includes(extname(path)));
  const adminSource = adminSourceFiles.map((path) => readFileSync(path, 'utf-8')).join('\n');

  for (const entry of serviceMap.values()) {
    const pageSource = resolveDocumentedPage(entry.page);
    const knownGap = entry.status === 'known_gap';
    const errors = [];
    if (!pageSource) errors.push(`Documented page source does not exist: ${entry.page}`);
    if (!entry.apiMethod || !adminSource.includes(entry.apiMethod.split('.').pop())) {
      errors.push(`API client method is not referenced in admin source: ${entry.apiMethod}`);
    }
    const endpointFragment = entry.endpoint
      .replace(/^(GET|POST|PATCH|PUT|DELETE)\s+/, '')
      .replace(/^\/api\/v1/, '')
      .replace(/:[^/]+/g, '');
    if (entry.dataSource === 'real' && !adminSource.includes(endpointFragment)) {
      errors.push(`Endpoint is not referenced in admin source: ${entry.endpoint}`);
    }
    const [expectedMethod, expectedPath] = entry.endpoint.split(/\s+/, 2);
    if (
      entry.dataSource === 'real'
      && !apiEndpoints.some((endpoint) =>
        endpoint.method === expectedMethod && endpoint.path === expectedPath)
    ) {
      errors.push(`Backing API endpoint does not exist: ${entry.endpoint}`);
    }

    records.push(coverageRecord({
      surface: 'admin',
      kind: 'endpoint',
      identifier: entry.route,
      activity: knownGap ? 'scaffold' : 'active',
      status: knownGap ? 'known_gap' : 'passed',
      evidence: `${entry.apiMethod} -> ${entry.endpoint}; page ${entry.page}`,
      errors,
      owner: entry.owner,
      followUp: knownGap ? entry.followUp : NONE,
    }));
  }
  return records;
}

function buildServiceWorkerCoverage() {
  const configPath = resolve(repoRoot(), 'apps/web/vite.config.ts');
  const swPath = resolve(repoRoot(), 'apps/web/dist/sw.js');
  const manifestPath = resolve(repoRoot(), 'apps/web/dist/manifest.webmanifest');
  const config = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '';
  const errors = [];
  if (!config.includes('VitePWA(')) errors.push('VitePWA configuration is missing');
  if (!existsSync(swPath)) errors.push('Current web build did not produce dist/sw.js');
  if (!existsSync(manifestPath)) errors.push('Current web build did not produce manifest.webmanifest');
  const runStartedAt = process.env.VERIFICATION_RUN_STARTED_AT;
  if (runStartedAt && existsSync(swPath) && statSync(swPath).mtimeMs < Date.parse(runStartedAt)) {
    errors.push('dist/sw.js predates the current verification run');
  }
  if (runStartedAt && existsSync(manifestPath) && statSync(manifestPath).mtimeMs < Date.parse(runStartedAt)) {
    errors.push('manifest.webmanifest predates the current verification run');
  }
  return coverageRecord({
    surface: 'web',
    kind: 'service-worker',
    identifier: 'vite-pwa',
    evidence: 'apps/web/vite.config.ts and current apps/web/dist output',
    errors,
  });
}

function writeAuditMarkdown(surface, records, outputPath) {
  const lines = [
    `# ${surface === 'web' ? 'Web' : 'Admin'} Coverage Audit`,
    '',
    'Generated by `npm run verify:routes` from the current repository.',
    '',
    '| Kind | Identifier | Activity | Status | Blocking | Evidence | Owner | Follow-up |',
    '|---|---|---|---|---|---|---|---|',
    ...records
      .filter((record) => record.surface === surface)
      .map((record) => `| ${record.kind} | ${record.identifier} | ${record.activity} | ${record.status} | ${record.blocking} | ${record.evidence} | ${record.owner} | ${record.followUp} |`),
    '',
  ];
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}

function fetchUrl(url) {
  return new Promise((resolvePromise, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolvePromise({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    }).on('error', reject);
  });
}

function startPreviewServer(rootDir, port) {
  return new Promise((resolvePromise, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolve(rootDir, req.url === '/' ? 'index.html' : req.url.slice(1));
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const content = readFileSync(filePath);
        const ext = extname(filePath).toLowerCase();
        const mime = {
          '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
          '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
        }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } else {
        const indexPath = resolve(rootDir, 'index.html');
        if (existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(indexPath));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
    server.on('error', reject);
  });
}

function parameterizeRoutePath(path) {
  return path.replace(/:(\w+)/g, (_, param) => {
    if (param === 'id' || param === 'tripId' || param.includes('Id')) return 'test-000';
    if (param === 'slug') return 'test-slug';
    return 'test';
  });
}

export async function verifyRoutesLoad(surface, routes, distOverride) {
  const distDir = distOverride || resolve(repoRoot(), `apps/${surface}/dist`);
  if (!existsSync(distDir)) {
    return { passed: false, errors: [`${surface}/dist directory not found`], evidence: [] };
  }
  const port = 0;
  const server = await startPreviewServer(distDir, port);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const errors = [];
  const evidence = [];

  try {
    for (const route of routes) {
      if (route.isRedirect) continue;
      const path = parameterizeRoutePath(route.path);
      const url = `${baseUrl}${path}`;
      try {
        const response = await fetchUrl(url);
        if (response.statusCode !== 200) {
          errors.push(`${surface} route ${route.path} returned ${response.statusCode}`);
          continue;
        }
        if (!response.contentType.includes('text/html')) {
          evidence.push(`${surface} route ${route.path}: HTTP 200 (${response.contentType})`);
          continue;
        }
        evidence.push(`${surface} route ${route.path}: HTTP 200 HTML`);

        const scriptMatches = response.body.match(/<script[^>]+src="([^"]+)"/g) || [];
        for (const scriptTag of scriptMatches) {
          const src = scriptTag.match(/src="([^"]+)"/)?.[1];
          if (!src || src.startsWith('http')) continue;
          const chunkUrl = `${baseUrl}/${src.replace(/^\//, '')}`;
          try {
            const chunkRes = await fetchUrl(chunkUrl);
            if (chunkRes.statusCode !== 200) {
              errors.push(`${surface} route ${route.path}: lazy chunk ${src} returned ${chunkRes.statusCode}`);
            }
          } catch {
            errors.push(`${surface} route ${route.path}: lazy chunk ${src} failed to load`);
          }
        }
      } catch (fetchErr) {
        errors.push(`${surface} route ${route.path}: HTTP request failed: ${fetchErr.message}`);
      }
    }
  } finally {
    server.close();
  }

  return { passed: errors.length === 0, errors, evidence };
}

export async function runRouteAudit({
  webRouter = extractWebRouterPath(),
  adminRouter = extractAdminRouterPath(),
  serviceMapPath = resolve(repoRoot(), 'docs/baseline/admin-page-service-map.md'),
  writeArtifacts = true,
  includeServiceWorker = true,
  distOverrides = {},
} = {}) {
  const serviceMap = loadAdminServiceMap(serviceMapPath);
  const web = await extractRoutes(webRouter);
  const admin = await extractRoutes(adminRouter);
  const apiEndpoints = await extractApiEndpoints();
  const webBuild = currentBuildEvidence('web');
  const adminBuild = currentBuildEvidence('admin');
  if (web.routes.length === 0) throw new Error('No web routes were extracted');
  if (admin.routes.length === 0) throw new Error('No admin routes were extracted');

  const records = [
    ...buildRouteCoverage('web', web, serviceMap, webBuild),
    ...buildRouteCoverage('admin', admin, serviceMap, adminBuild),
    ...buildAdminServiceCoverage(serviceMap, apiEndpoints),
    ...(includeServiceWorker ? [buildServiceWorkerCoverage()] : []),
  ];
  const validation = validateCoverageRecords(records);
  const blockingIssues = records.filter((record) => record.blocking);
  if (!validation.valid) {
    throw new Error(`Coverage record validation failed: ${validation.errors.join('; ')}`);
  }

  const runtimeErrors = [];
  const runtimeEvidence = [];

  try {
    const webRuntime = await verifyRoutesLoad('web', web.routes, distOverrides?.web);
    if (!webRuntime.passed) {
      runtimeErrors.push(...webRuntime.errors.map((e) => `web:${e}`));
    }
    runtimeEvidence.push(...webRuntime.evidence);
  } catch (err) {
    runtimeErrors.push(`web runtime verification error: ${err.message}`);
  }

  try {
    const adminRuntime = await verifyRoutesLoad('admin', admin.routes, distOverrides?.admin);
    if (!adminRuntime.passed) {
      runtimeErrors.push(...adminRuntime.errors.map((e) => `admin:${e}`));
    }
    runtimeEvidence.push(...adminRuntime.evidence);
  } catch (err) {
    runtimeErrors.push(`admin runtime verification error: ${err.message}`);
  }

  if (runtimeErrors.length > 0) {
    records.push(coverageRecord({
      surface: 'web',
      kind: 'route',
      identifier: 'runtime-load',
      status: 'failed',
      evidence: `Runtime route loading verification; ${runtimeEvidence.length} routes checked`,
      errors: runtimeErrors,
    }));
  }

  const result = {
    runId: process.env.VERIFICATION_RUN_ID || 'standalone',
    generatedAt: new Date().toISOString(),
    web: { sourceFile: repositoryPath(web.sourceFile), routes: web.routes },
    admin: { sourceFile: repositoryPath(admin.sourceFile), routes: admin.routes },
    apiEndpoints,
    coverageRecords: records,
    blockingIssues: records.filter((record) => record.blocking),
    validated: true,
    runtimeEvidence,
  };

  if (writeArtifacts) {
    const artifactDirectory = resolve(repoRoot(), process.env.VERIFICATION_RUN_DIR || 'verification-output');
    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(resolve(artifactDirectory, 'route-audit.json'), JSON.stringify(result, null, 2), 'utf-8');
    writeAuditMarkdown('web', records, resolve(repoRoot(), 'docs/baseline/web-route-audit.md'));
    writeAuditMarkdown('admin', records, resolve(repoRoot(), 'docs/baseline/admin-route-audit.md'));
  }

  if (blockingIssues.length > 0) {
    throw new Error(blockingIssues.map((record) =>
      `${record.surface}:${record.kind}:${record.identifier}: ${record.blockingErrors.join(', ')}`,
    ).join('\n'));
  }

  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRouteAudit()
    .then((result) => {
      console.log(`Route audit passed with ${result.coverageRecords.length} current coverage records.`);
    })
    .catch((error) => {
      console.error(`Route audit failed:\n${error.message}`);
      process.exitCode = 1;
    });
}
