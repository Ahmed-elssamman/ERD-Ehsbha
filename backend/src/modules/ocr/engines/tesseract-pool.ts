import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';

const MAX_QUEUE_DEPTH = 8;
const MAX_WAIT_MS = 10_000;
const PER_IMAGE_TIMEOUT_MS = 25_000;

@Injectable()
export class TesseractPool implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TesseractPool.name);
  private worker: Worker | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private depth = 0;

  async onModuleInit(): Promise<void> {
    // Lazy by default. The OCR provider factory triggers warmUp() in the
    // background when tesseract is the active provider — that avoids the
    // ~2s download cost on the first OCR request without blocking boot
    // when a vision LLM is active and tesseract won't be used.
  }

  async warmUp(): Promise<void> {
    if (this.worker) return;
    try {
      this.worker = await createWorker(['eng', 'ara']);
      this.logger.log('OCR module: tesseract worker warmed (eng+ara)');
    } catch (err) {
      this.logger.error(`Failed to initialize tesseract worker: ${(err as Error).message}`);
      this.worker = null;
    }
  }

  async runExclusive<T>(fn: (worker: Worker) => Promise<T>): Promise<T> {
    if (this.depth >= MAX_QUEUE_DEPTH) {
      const err = new Error('OCR_BUSY');
      (err as Error & { code?: string }).code = 'OCR_BUSY';
      throw err;
    }
    this.depth += 1;

    const queuedAt = Date.now();
    const task = this.chain.then(async () => {
      const waited = Date.now() - queuedAt;
      if (waited > MAX_WAIT_MS) {
        const err = new Error('OCR_BUSY');
        (err as Error & { code?: string }).code = 'OCR_BUSY';
        throw err;
      }
      if (!this.worker) await this.warmUp();
      if (!this.worker) {
        const err = new Error('OCR_NOT_READY');
        (err as Error & { code?: string }).code = 'OCR_NOT_READY';
        throw err;
      }
      return Promise.race([
        fn(this.worker),
        new Promise<T>((_resolve, reject) => {
          setTimeout(() => {
            const err = new Error('OCR_TIMEOUT');
            (err as Error & { code?: string }).code = 'OCR_TIMEOUT';
            reject(err);
          }, PER_IMAGE_TIMEOUT_MS);
        }),
      ]);
    });

    this.chain = task.catch(() => undefined);

    try {
      return await task;
    } finally {
      this.depth -= 1;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (err) {
        this.logger.warn(`tesseract terminate failed: ${(err as Error).message}`);
      }
      this.worker = null;
    }
  }
}
