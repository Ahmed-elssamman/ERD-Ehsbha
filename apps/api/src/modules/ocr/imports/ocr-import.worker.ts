import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ocrExtractRequestHintsSchema } from '@ehsbha/api-contracts';
import { OcrService } from '../ocr.service';
import { OcrImportStore } from './ocr-import-store.service';
import { OCR_IMPORT_CLEANUP_MS, OCR_IMPORT_TICK_MS, OCR_IMPORT_WORKERS } from './ocr-import.control';

@Injectable()
export class OcrImportWorker implements OnApplicationShutdown {
  private logger = new Logger(OcrImportWorker.name);
  private running = false;
  private stopping = false;
  private lastCleanup = 0;

  constructor(private store: OcrImportStore, private ocr: OcrService) {}

  @Interval(OCR_IMPORT_TICK_MS)
  async tick(): Promise<void> {
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      if (Date.now() - this.lastCleanup >= OCR_IMPORT_CLEANUP_MS) {
        await this.store.cleanup();
        this.lastCleanup = Date.now();
      }
      const results = await Promise.allSettled(Array.from({ length: OCR_IMPORT_WORKERS }, () => this.processOne()));
      if (results.some((result) => result.status === 'rejected')) throw new Error('OCR_WORK_INTERRUPTED');
    } catch {
      // Do not log image content, provider responses or database parameters.
      // Unfinished leases are recoverable after a process or database failure.
      this.logger.warn('OCR import worker interrupted; unacknowledged work will be retried');
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown(): void { this.stopping = true; }

  private async processOne(): Promise<void> {
    const lease = await this.store.claim();
    if (!lease || !lease.image.payload) return;
    const hints = ocrExtractRequestHintsSchema.parse(lease.batch.hints);
    const extraction = await this.ocr.extractDocument({
      buffer: Buffer.from(lease.image.payload), mimetype: lease.image.mimeType, size: lease.image.size,
    }, lease.image.imageHash, lease.image.index, hints.platform, hints.mode === 'multi');
    await this.store.finish(lease, extraction);
  }
}
