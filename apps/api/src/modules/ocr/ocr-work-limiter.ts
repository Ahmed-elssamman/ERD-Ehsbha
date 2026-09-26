import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OCR_DOCUMENT_CONCURRENCY, OCR_MAX_WAITING_DOCUMENTS } from './ocr.control';

/** One shared limit across requests; each task includes decoding and provider work. */
@Injectable()
export class OcrWorkLimiter {
  private active = 0;
  private waiting: Array<() => void> = [];

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= OCR_DOCUMENT_CONCURRENCY) {
      if (this.waiting.length >= OCR_MAX_WAITING_DOCUMENTS) throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}
