import type { ImageSignals } from './types';

export abstract class OcrRecognitionProvider {
  abstract recognize(image: Buffer): Promise<ImageSignals>;
}
