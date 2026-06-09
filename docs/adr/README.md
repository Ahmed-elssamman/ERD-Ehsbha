# Architecture Decision Records

## When is an ADR Mandatory?

An ADR is required for any decision that:
- Changes architecture, framework, or infrastructure
- Introduces a new external dependency
- Changes the verification or delivery process
- Has cross-team or cross-application impact
- Is irreversible or costly to reverse

## Lifecycle States

- **proposed** — under review
- **accepted** — approved and implemented
- **superseded** — replaced by a later ADR
- **deprecated** — no longer relevant

## Numbering

Sequential, zero-padded (0001, 0002, ...).

## Review Ownership

The engineering lead or tech owner approves ADR acceptance.

## Superseding Rules

A new ADR may supersede an existing one by referencing its number in the Supersedes field. The superseded ADR status is updated accordingly.

## Links

- [Constitution](../../.specify/memory/constitution.md) — governing principles
- [0001 Windows Authoritative Phase 0](0001-windows-authoritative-phase-0-verification.md)
