const VALID_SURFACES = ['web', 'admin', 'api'];
const VALID_KINDS = ['route', 'page', 'endpoint', 'permission', 'translation', 'empty-state', 'error-state', 'service-worker'];
const VALID_ACTIVITIES = ['active', 'obsolete', 'scaffold'];
const VALID_STATUSES = ['passed', 'failed', 'known_gap'];

export function validateCoverageRecord(record) {
  const errors = [];

  if (!VALID_SURFACES.includes(record.surface)) {
    errors.push(`Invalid surface: ${record.surface}`);
  }

  if (!VALID_KINDS.includes(record.kind)) {
    errors.push(`Invalid kind: ${record.kind}`);
  }

  if (!VALID_ACTIVITIES.includes(record.activity)) {
    errors.push(`Invalid activity: ${record.activity}`);
  }

  if (!VALID_STATUSES.includes(record.status)) {
    errors.push(`Invalid status: ${record.status}`);
  }

  if (!record.identifier) {
    errors.push('Missing identifier');
  }

  if (!record.evidence) {
    errors.push('Missing evidence');
  }

  if (record.blocking === undefined || record.blocking === null) {
    errors.push('Missing blocking flag');
  }

  if (!record.owner) {
    errors.push('Missing owner');
  }

  if (!record.followUp) {
    errors.push('Missing follow-up reference');
  }

  if (!Array.isArray(record.blockingErrors)) {
    errors.push('Missing blockingErrors array');
  }

  if (record.activity === 'active' && record.status === 'failed' && !record.blocking) {
    errors.push('Active failed coverage must have blocking=true');
  }

  if (record.status === 'failed' && record.blockingErrors?.length === 0) {
    errors.push('Failed coverage requires at least one blocking error');
  }

  if (record.status !== 'failed' && record.blockingErrors?.length > 0) {
    errors.push('Only failed coverage may contain blocking errors');
  }

  if (record.status === 'known_gap' && !record.owner) {
    errors.push('Known gap requires an owner');
  }

  if (record.status === 'known_gap' && !record.followUp) {
    errors.push('Known gap requires a follow-up reference');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCoverageRecords(records) {
  const results = records.map(r => validateCoverageRecord(r));
  const failed = results.filter(r => !r.valid);
  const identifiers = new Set();
  const duplicateErrors = [];
  for (const record of records) {
    const key = `${record.surface}:${record.kind}:${record.identifier}`;
    if (identifiers.has(key)) duplicateErrors.push(`Duplicate coverage identifier: ${key}`);
    identifiers.add(key);
  }
  return {
    valid: failed.length === 0 && duplicateErrors.length === 0,
    errors: [...failed.flatMap(r => r.errors), ...duplicateErrors],
  };
}

export default validateCoverageRecord;
