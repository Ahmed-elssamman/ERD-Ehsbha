import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { getAllOperations } from '../../packages/api-contracts/dist/cjs/index.js';
import { getErrorDefinition } from '../../packages/api-contracts/dist/cjs/core/errors.js';
import { buildCatalogData, EXPECTED_CONTROLLER_COUNT, EXPECTED_ROUTE_COUNT } from './catalog-data.mjs';
import { buildOpenApiDocument } from './generate-openapi.mjs';
import { pathsMatch } from '../verification/lib/extract-api-consumers.mjs';

const catalogPath = resolve(import.meta.dirname, '../../verification-output/contracts/contract-catalog.json');
const openApiPath = resolve(import.meta.dirname, '../../verification-output/contracts/openapi.json');
const schemaPath = resolve(
  import.meta.dirname,
  '../../specs/002-shared-platform-contracts/contracts/contract-catalog.schema.json',
);

function stable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const errors = [];
const { catalog, routes, consumers, diagnostics } = await buildCatalogData(getAllOperations());
const missingRouteKeys = new Set(
  diagnostics
    .filter((diagnostic) => diagnostic.code === 'UNREGISTERED_ROUTE' && diagnostic.route)
    .map((diagnostic) => `${diagnostic.route.method} ${diagnostic.route.path}`),
);
for (const diagnostic of diagnostics) {
  if (diagnostic.severity === 'error') errors.push(diagnostic.message);
}
const publicCatalog = {
  ...catalog,
  operations: catalog.operations.map(({
    controller: _controller,
    handler: _handler,
    sourceLine: _sourceLine,
    ...operation
  }) => operation),
};

const controllers = new Set(routes.map((route) => route.source));
if (routes.length !== EXPECTED_ROUTE_COUNT) {
  errors.push(`Expected ${EXPECTED_ROUTE_COUNT} active controller routes, found ${routes.length}`);
}
if (controllers.size !== EXPECTED_CONTROLLER_COUNT) {
  errors.push(`Expected ${EXPECTED_CONTROLLER_COUNT} controllers, found ${controllers.size}`);
}
if (publicCatalog.operations.length !== routes.length) {
  errors.push(`Catalog has ${publicCatalog.operations.length} operations for ${routes.length} routes`);
}

const ids = new Set();
const routeKeys = new Set();
for (const operation of publicCatalog.operations) {
  if (ids.has(operation.operationId)) errors.push(`Duplicate operation ID: ${operation.operationId}`);
  ids.add(operation.operationId);
  const key = `${operation.method} ${operation.path.replace(/:[^/]+/g, ':param')}`;
  if (routeKeys.has(key)) errors.push(`Duplicate method/path: ${key}`);
  routeKeys.add(key);
  if (!operation.successSchema) errors.push(`Missing success schema: ${operation.operationId}`);
  for (const code of operation.failureCodes) {
    if (!getErrorDefinition(code)) errors.push(`Unknown error code ${code}: ${operation.operationId}`);
  }
}

for (const route of routes) {
  if (missingRouteKeys.has(`${route.method} ${route.path}`)) continue;
  const matches = publicCatalog.operations.filter((operation) =>
    operation.method === route.method && pathsMatch(operation.path, route.path));
  if (matches.length !== 1) {
    errors.push(`${route.method} ${route.path} has ${matches.length} catalog bindings`);
  }
}

for (const consumer of consumers) {
  if (missingRouteKeys.has(`${consumer.method} ${consumer.path}`)) continue;
  const matches = publicCatalog.operations.filter((operation) =>
    operation.method === consumer.method && pathsMatch(operation.path, consumer.path));
  if (matches.length !== 1) {
    errors.push(`${consumer.application} ${consumer.source}:${consumer.line} has ${matches.length} operation bindings`);
    continue;
  }
  if (!matches[0].consumers.some((binding) =>
    binding.application === consumer.application && binding.sourcePath === consumer.source)) {
    errors.push(`${consumer.application} binding missing for ${matches[0].operationId}`);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
if (!ajv.validate(schema, publicCatalog)) {
  errors.push(`Catalog JSON Schema failed: ${ajv.errorsText(ajv.errors)}`);
}

if (errors.length === 0) {
  const expectedOpenApi = await buildOpenApiDocument();
  const actualCatalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  const actualOpenApi = JSON.parse(readFileSync(openApiPath, 'utf-8'));
  if (stable(actualCatalog) !== stable(publicCatalog)) errors.push('contract-catalog.json is stale');
  if (stable(actualOpenApi) !== stable(expectedOpenApi)) errors.push('openapi.json is stale');
  const openApiOperationCount = Object.values(actualOpenApi.paths || {}).reduce(
    (count, item) => count + Object.keys(item).filter((key) =>
      ['get', 'post', 'put', 'patch', 'delete'].includes(key)).length,
    0,
  );
  if (openApiOperationCount !== routes.length) {
    errors.push(`OpenAPI has ${openApiOperationCount} operations for ${routes.length} routes`);
  }

  for (const [path, pathItem] of Object.entries(actualOpenApi.paths || {})) {
    for (const operation of Object.values(pathItem)) {
      const schemaRef = operation?.responses?.['200']?.content?.['application/json']?.schema;
      if (!schemaRef || (schemaRef.type === 'object' && Object.keys(schemaRef).length === 1)) {
        errors.push(`Placeholder success schema remains at ${path}`);
      }
    }
  }
}

if (errors.length) {
  console.error('Contract verification failed:');
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

const counts = consumers.reduce((result, consumer) => {
  result[consumer.application] = (result[consumer.application] || 0) + 1;
  return result;
}, {});
console.log(
  `Contract verification passed: ${routes.length} routes, ${controllers.size} controllers, `
  + `${counts.web || 0} web consumers, ${counts.admin || 0} admin consumers`,
);
