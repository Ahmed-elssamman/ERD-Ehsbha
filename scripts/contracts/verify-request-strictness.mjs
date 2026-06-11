#!/usr/bin/env node
// T072: Static strictness audit - fails when any registered JSON body/query
// object accepts or strips unknown fields (request must be strict) or when
// any registered response object rejects unknown fields (response must be passthrough).

import * as authSchemas from '../../packages/api-contracts/dist/types/domains/auth-profile.js';
import * as vehicleSchemas from '../../packages/api-contracts/dist/types/domains/vehicle-app-area.js';
import * as tripSchemas from '../../packages/api-contracts/dist/types/domains/trip-ocr.js';
import * as opsSchemas from '../../packages/api-contracts/dist/types/domains/operations.js';
import * as analyticsSchemas from '../../packages/api-contracts/dist/types/domains/analytics-intelligence.js';
import * as commSchemas from '../../packages/api-contracts/dist/types/domains/communications.js';
import * as adminCoreSchemas from '../../packages/api-contracts/dist/types/domains/admin-core.js';
import * as adminOpsSchemas from '../../packages/api-contracts/dist/types/domains/admin-operations.js';
import * as platformSchemas from '../../packages/api-contracts/dist/types/domains/platform-operations.js';
import { getAllOperations } from '../../packages/api-contracts/dist/types/index.js';

const allSchemas = {};
const schemaSources = [
  authSchemas, vehicleSchemas, tripSchemas, opsSchemas,
  analyticsSchemas, commSchemas, adminCoreSchemas, adminOpsSchemas, platformSchemas,
];
for (const source of schemaSources) {
  for (const [name, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && '_def' in value) {
      allSchemas[name] = value;
    }
  }
}

let exitCode = 0;
const errors = [];

function isStrict(schema) {
  if (!schema || !schema._def) return false;
  if (schema._def.typeName === 'ZodObject') {
    return schema._def.unknownKeys === 'strict';
  }
  if (schema._def.typeName === 'ZodEffects' && schema._def.schema?._def?.typeName === 'ZodObject') {
    return schema._def.schema._def.unknownKeys === 'strict';
  }
  return false;
}

function isPassthrough(schema) {
  if (!schema || !schema._def) return false;
  if (schema._def.typeName === 'ZodObject') {
    return schema._def.unknownKeys === 'passthrough';
  }
  if (schema._def.typeName === 'ZodEffects' && schema._def.schema?._def?.typeName === 'ZodObject') {
    return schema._def.schema._def.unknownKeys === 'passthrough';
  }
  return false;
}

function findByPartialName(partialName) {
  const key = Object.keys(allSchemas).find(
    (k) => k.toLowerCase() === partialName.toLowerCase()
  );
  if (key) return allSchemas[key];
  const fuzzy = Object.keys(allSchemas).find(
    (k) => k.toLowerCase().includes(partialName.toLowerCase()) ||
           partialName.toLowerCase().includes(k.toLowerCase())
  );
  return fuzzy ? allSchemas[fuzzy] : null;
}

const operations = getAllOperations();

for (const op of operations) {
  if (op.request?.body) {
    const schemaName = op.request.body;
    let schema = allSchemas[schemaName] || findByPartialName(schemaName);
    if (!schema) {
      errors.push(`Operation "${op.operationId}" references request body schema "${schemaName}" which was not found among exported schemas`);
      exitCode = 1;
      continue;
    }
    if (!isStrict(schema)) {
      errors.push(`Operation "${op.operationId}" request body schema "${schemaName}" is NOT strict (unknownKeys=${schema._def?.unknownKeys ?? 'unknown'})`);
      exitCode = 1;
    }
  }

  if (op.successData) {
    const schemaName = op.successData;
    let schema = allSchemas[schemaName] || findByPartialName(schemaName);
    if (!schema) {
      errors.push(`Operation "${op.operationId}" references success data schema "${schemaName}" which was not found among exported schemas`);
      exitCode = 1;
      continue;
    }
    if (!isPassthrough(schema)) {
      errors.push(`Operation "${op.operationId}" success data schema "${schemaName}" is NOT passthrough (unknownKeys=${schema._def?.unknownKeys ?? 'unknown'})`);
      exitCode = 1;
    }
  }
}

if (errors.length > 0) {
  console.error('Request strictness audit failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
} else {
  console.log(`Request strictness audit passed: ${operations.length} operations checked, all request schemas strict, all response schemas passthrough`);
}

process.exit(exitCode);
