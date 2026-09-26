import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as contracts from '../../packages/api-contracts/dist/cjs/index.js';
import { FailureEnvelopeSchema, SuccessEnvelopeSchema } from '../../packages/api-contracts/dist/cjs/core/index.js';
import { buildCatalogData } from './catalog-data.mjs';

extendZodWithOpenApi(z);

const OUTPUT_DIR = resolve(import.meta.dirname, '../../verification-output/contracts');

function isZodSchema(value) {
  return Boolean(value && typeof value === 'object' && typeof value.safeParse === 'function');
}

function fallbackSchema(name, isRequest) {
  const schema = isRequest ? z.object({}).strict() : z.object({ ok: z.boolean().optional() }).passthrough();
  return schema.describe(`Fallback schema for ${name}; verification requires a named contract binding`);
}

function schemaByName(name, isRequest = false) {
  const candidate = contracts[name];
  return isZodSchema(candidate) ? candidate : fallbackSchema(name, isRequest);
}

function parameterSchema(path) {
  const fields = {};
  for (const match of path.matchAll(/:([^/]+)/g)) fields[match[1]] = z.string().min(1);
  return Object.keys(fields).length ? z.object(fields).strict() : null;
}

export async function buildOpenApiDocument() {
  const { catalog, diagnostics } = await buildCatalogData(contracts.getAllOperations());
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (blockingDiagnostics.length > 0) {
    const details = blockingDiagnostics.map((diagnostic) => `- ${diagnostic.message}`).join('\n');
    throw new Error(`OpenAPI generation failed:\n${details}`);
  }
  const registry = new OpenAPIRegistry();

  registry.register('ResponseMeta', contracts.ResponseMetaSchema);
  registry.register('FailureEnvelope', FailureEnvelopeSchema);

  for (const operation of catalog.operations) {
    const dataSchema = schemaByName(operation.successSchema);
    const responseSchema = SuccessEnvelopeSchema(dataSchema);
    const params = parameterSchema(operation.path);
    const queryName = operation.requestSchemas.query;
    const bodyName = operation.requestSchemas.body;
    const request = {};
    if (params) request.params = params;
    if (queryName) request.query = schemaByName(queryName, true);
    if (bodyName) {
      request.body = {
        required: true,
        content: {
          'application/json': { schema: schemaByName(bodyName, true) },
        },
      };
    }

    registry.registerPath({
      method: operation.method.toLowerCase(),
      path: operation.path.replace(/:([^/]+)/g, '{$1}'),
      operationId: operation.operationId,
      summary: `${operation.controller}.${operation.handler}`,
      tags: [operation.realm],
      request,
      responses: {
        200: {
          description: 'Governed success envelope',
          content: { 'application/json': { schema: responseSchema } },
        },
        400: {
          description: 'Governed failure envelope',
          content: { 'application/json': { schema: FailureEnvelopeSchema } },
        },
        401: {
          description: 'Governed authentication failure',
          content: { 'application/json': { schema: FailureEnvelopeSchema } },
        },
        500: {
          description: 'Governed internal failure',
          content: { 'application/json': { schema: FailureEnvelopeSchema } },
        },
      },
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Ehsbha API',
      version: contracts.CONTRACT_VERSION,
      description: 'Generated from the complete controller and shared-contract inventory',
    },
    servers: [{ url: '/api/v1' }],
  });
}

export async function generateOpenApi() {
  const document = await buildOpenApiDocument();
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUTPUT_DIR, 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
    'utf-8',
  );
  return document;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const document = await generateOpenApi();
  console.log(`OpenAPI written with ${Object.keys(document.paths || {}).length} paths`);
}
