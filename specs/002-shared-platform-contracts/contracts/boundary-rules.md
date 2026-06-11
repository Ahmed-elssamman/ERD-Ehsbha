# Dependency Boundary Rules

## Allowed Graph

```text
shared-types
  <- api-contracts

shared-types
  <- api
  <- web
  <- admin

api-contracts
  <- api
  <- web
  <- admin

ui-tokens
  <- web
  <- admin

eslint-config
  <- repository lint configuration
```

Arrows mean "may be imported by".

## Forbidden Dependencies

- `apps/web` to `apps/admin`
- `apps/admin` to `apps/web`
- Either frontend to `apps/api` source
- Either frontend to Prisma, NestJS, server configuration, secrets, migrations, or provider SDKs
- `shared-types` to Zod, applications, browser APIs, NestJS, Prisma, Axios, or providers
- `api-contracts` to applications, browser state, React, NestJS, Prisma, Axios, or providers
- `ui-tokens` to pages, layouts, routes, auth state, domain clients, or workflows
- Any application or shared-package cycle
- Imports that bypass package public exports
- Runtime package imports not declared in the importing workspace manifest

## Enforcement Layers

1. ESLint catches direct source imports during editing and lint.
2. TypeScript project references and package exports prevent private path consumption.
3. dependency-cruiser catches aliases, dynamic imports, transitive paths, undeclared dependencies,
   and cycles.
4. Production artifact scanning proves driver-specific modules are absent from admin output and
   admin-specific modules are absent from driver output.
5. Controlled fixtures prove each forbidden category fails with the responsible path in output.

## Required Failure Evidence

Each rule has:

- Stable rule ID
- Failing fixture
- Passing fixture
- Expected source-to-target dependency path
- Verification test asserting a non-zero exit status
- Remediation text naming the correct shared package or application boundary
