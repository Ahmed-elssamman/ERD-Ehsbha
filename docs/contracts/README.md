# Shared Platform Contracts

## Overview

This directory documents the shared API contracts, their evolution, and coordinated release process.

## Quick Reference

- **Catalog**: Generated at `verification-output/contracts/contract-catalog.json`
- **OpenAPI**: Generated at `verification-output/contracts/openapi.json`
- **Schema Registry**: `packages/api-contracts/src/catalog/registry.ts`
- **Core Primitives**: `packages/api-contracts/src/core/`

## Authoring Contracts

1. Define Zod schemas in `packages/api-contracts/src/domains/<domain>.ts`
2. Register operations using `registerOperation()` from the catalog registry
3. Add tests in `<domain>.spec.ts`
4. Generate the catalog with `npm run contracts:generate`

## Operation Registration

Each operation requires:
- Unique `operationId` in `<realm>.<domain>.<action>` format
- HTTP method, path, realm, and lifecycle status
- Request schema names and success data schema
- Failure codes from the governed error catalog
- Consumer bindings with migration status
- Compatibility classification
- Owner and optional follow-up

## Compatibility Classes

- `additive-compatible`: Adding optional fields to responses
- `behaviorally-changed`: Changing semantics without breaking the wire format
- `incompatible`: Breaking field removals, type changes, or required field additions
