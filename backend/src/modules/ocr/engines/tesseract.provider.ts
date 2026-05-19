import { Injectable } from '@nestjs/common';
import { OcrProvider, OcrResult, OcrWord } from './ocr-provider.interface';
import { TesseractPool } from './tesseract-pool';

@Injectable()
export class TesseractOcrProvider implements OcrProvider {
  constructor(private readonly pool: TesseractPool) {}

  async warmUp(): Promise<void> {
    await this.pool.warmUp();
  }

  async dispose(): Promise<void> {
    // No-op — the pool is module-scoped and terminates on OnModuleDestroy.
  }

  async recognize(buf: Buffer): Promise<OcrResult> {
    return this.pool.runExclusive(async (worker) => {
      const result = await worker.recognize(buf);
      const data = result.data as unknown as {
        text: string;
        confidence: number;
        words?: Array<{ text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }>;
      };
      const text = data.text ?? '';
      const meanConfidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
      const words: OcrWord[] = (data.words ?? []).map((w) => ({
        text: w.text,
        confidence: Math.max(0, Math.min(1, (w.confidence ?? 0) / 100)),
        bbox: w.bbox
          ? { x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 }
          : undefined,
      }));
      return { text, meanConfidence, words };
    });
  }
}
