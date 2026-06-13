import { extractApiEndpoints } from '../verification/lib/extract-api-endpoints.mjs';
import { extractApiConsumers, pathsMatch } from '../verification/lib/extract-api-consumers.mjs';

export const EXPECTED_ROUTE_COUNT = 161;
export const EXPECTED_CONTROLLER_COUNT = 40;
export const GENERATED_AT = '2026-06-12T00:00:00.000Z';

function canonicalPath(path) {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

function routeKey(method, path) {
  return `${method} ${canonicalPath(path).replace(/:[^/]+/g, ':param')}`;
}

function normalizedRequestSchemas(request = {}) {
  return Object.fromEntries(
    Object.entries(request).filter(([, schema]) => typeof schema === 'string' && schema.length > 0),
  );
}

export async function buildCatalogData(registryOperations) {
  const [routes, discoveredConsumers] = await Promise.all([
    extractApiEndpoints(),
    extractApiConsumers(),
  ]);
  const diagnostics = [];
  const registryByRoute = new Map(
    registryOperations
      .filter((operation) => operation.method && operation.path)
      .map((operation) => [routeKey(operation.method, operation.path), operation]),
  );

  const operations = [];
  for (const route of routes) {
    const registered = registryByRoute.get(routeKey(route.method, route.path));
    if (!registered) {
      diagnostics.push({
        severity: 'error',
        code: 'UNREGISTERED_ROUTE',
        message: `Missing registered shared contract for ${route.method} ${route.path}`,
        route,
      });
      continue;
    }

    const requestSchemas = normalizedRequestSchemas(route.requestSchemas);
    const registeredRequestSchemas = normalizedRequestSchemas(registered.request);
    for (const [binding, schema] of Object.entries(requestSchemas)) {
      if (!registeredRequestSchemas[binding]) {
        diagnostics.push({
          severity: 'error',
          code: 'MISSING_REQUEST_BINDING',
          message: `${registered.operationId} is missing registered ${binding} schema ${schema}`,
          route,
          operationId: registered.operationId,
        });
      }
    }

    for (const [binding, schema] of Object.entries(registeredRequestSchemas)) {
      if (!requestSchemas[binding]) {
        diagnostics.push({
          severity: 'error',
          code: 'UNUSED_REQUEST_BINDING',
          message: `${registered.operationId} registers ${binding} schema ${schema} but the controller extractor found no ${binding} binding`,
          route,
          operationId: registered.operationId,
        });
      }
    }

    const consumers = discoveredConsumers
      .filter((consumer) => consumer.method === route.method && pathsMatch(consumer.path, route.path))
      .map((consumer) => ({
        application: consumer.application,
        sourcePath: consumer.source,
        role: 'consumer',
        migrationStatus: 'shared',
        owner: consumer.application,
        followUp: null,
      }));

    operations.push({
      operationId: registered.operationId,
      transport: 'http',
      method: route.method,
      path: route.path,
      realm: registered.realm,
      lifecycle: registered.lifecycle,
      requestSchemas,
      successSchema: registered.successData,
      failureCodes: registered.failureCodes,
      pagination: registered.pagination,
      idempotency: registered.idempotency,
      consumers: [
        {
          application: 'api',
          sourcePath: route.source,
          role: 'producer',
          migrationStatus: 'shared',
          owner: 'api',
          followUp: null,
        },
        ...consumers,
      ],
      compatibility: registered.compatibility,
      owner: registered.owner,
      followUp: registered.followUp,
      controller: route.controller,
      handler: route.handler,
      sourceLine: route.line,
    });
  }

  for (const operation of registryOperations.filter((entry) => entry.method && entry.path)) {
    const matchedRoute = routes.find((route) => routeKey(route.method, route.path) === routeKey(operation.method, operation.path));
    if (!matchedRoute) {
      diagnostics.push({
        severity: 'error',
        code: 'ORPHANED_OPERATION',
        message: `Registered operation ${operation.operationId} does not match any active controller route`,
        operationId: operation.operationId,
      });
    }
  }

  return {
    catalog: {
      contractVersion: '1.0.0',
      apiVersion: 'v1',
      generatedAt: GENERATED_AT,
      operations,
    },
    diagnostics,
    routes,
    consumers: discoveredConsumers,
  };
}

export function catalogRouteKey(operation) {
  return routeKey(operation.method, operation.path);
}
