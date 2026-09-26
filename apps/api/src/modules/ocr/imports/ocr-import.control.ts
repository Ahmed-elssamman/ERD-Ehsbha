export const OCR_IMPORT_STORAGE_BYTES = 256 * 1024 * 1024;
export const OCR_IMPORT_PENDING_IMAGES = 200;
export const OCR_IMPORT_MAX_PENDING_PER_DRIVER = 3;
export const OCR_IMPORT_REQUESTS_PER_HOUR = 12;
export const OCR_IMPORT_UPLOADS_PER_WINDOW = 200;
export const OCR_IMPORT_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
export const OCR_IMPORT_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const OCR_IMPORT_RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OCR_IMPORT_LEASE_MS = 90 * 1000;
export const OCR_IMPORT_MAX_ATTEMPTS = 3;
export const OCR_IMPORT_WORKERS = 2;
export const OCR_IMPORT_TICK_MS = 1000;
export const OCR_IMPORT_CLEANUP_MS = 60 * 1000;
// A transaction-scoped PostgreSQL lock shared by every API worker process.
export const OCR_IMPORT_LOCK_NAMESPACE = 18473;
export const OCR_IMPORT_LOCK_KEY = 1;
export const OCR_IMPORT_RETRY_CODES = new Set(['OCR_FAILED', 'OCR_TIMEOUT', 'OCR_BUSY', 'RATE_LIMITED']);
