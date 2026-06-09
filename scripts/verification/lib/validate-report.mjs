import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let validator = null;

async function getValidator() {
  if (validator) return validator;
  const schemaPath = resolve(__dirname, '../../../specs/001-baseline-governance/contracts/baseline-report.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const { default: Ajv } = await import('ajv');
  const addFormats = (await import('ajv-formats')).default;
  const ajv = new Ajv({ strict: true, allErrors: true, allowMatchingProperties: true, validateSchema: false });
  addFormats(ajv);
  validator = ajv.compile(schema);
  return validator;
}

export async function validateReport(report) {
  const validate = await getValidator();
  const valid = validate(report);
  if (!valid) {
    const errors = validate.errors.map(e => `${e.instancePath} ${e.message}`).join('; ');
    return { valid: false, errors };
  }
  return { valid: true, errors: null };
}

export default validateReport;
