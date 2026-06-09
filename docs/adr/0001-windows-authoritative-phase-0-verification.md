# ADR-0001: Windows-Authoritative Phase 0 Verification

**Status**: accepted
**Date**: 2026-06-07
**Owner**: Phase 0 Team

## Context

Phase 0 establishes the repository quality baseline. The development team and CI environment use supported 64-bit Windows. Linux compatibility would multiply the verification matrix without immediate benefit.

## Decision

Phase 0 verification is authoritative on supported 64-bit Windows environments. Linux runs provide informational results and do not establish Phase 0 acceptance.

## Alternatives

- **Windows and Linux parity**: Rejected because it expands Phase 0 scope.
- **Linux-only authority**: Rejected because it conflicts with the development environment.

## Consequences

- Windows is the single verification target.
- Linux results are informational.
- Future Linux compatibility is possible but deferred.
- The support matrix documents Linux as `deferred`.
- CI runs on Windows runners.
