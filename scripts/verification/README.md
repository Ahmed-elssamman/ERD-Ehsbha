# Verification Scripts

## Naming

Scripts use kebab-case with stable step IDs corresponding to verify.mjs step names.

## Exit Codes

- 0: passed
- 1: failed
- 2: not_applicable

## Redaction Rules

Secrets, tokens, passwords, connection strings, private images, and personal data MUST be
redacted from all output, logs, and reports before writing to disk.

## Windows Authority

Phase 0 verification is authoritative on supported 64-bit Windows environments. Linux results
are informational and do not establish Phase 0 acceptance.

## Path Resolution

All scripts MUST resolve paths relative to the repository root using `scripts/verification/lib/paths.mjs`,
not the caller's current working directory.

## References

- [Verification Interface Contract](../../specs/001-baseline-governance/contracts/verification-interface.md)
- [Baseline Report Schema](../../specs/001-baseline-governance/contracts/baseline-report.schema.json)
