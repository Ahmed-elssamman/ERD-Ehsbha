import { Injectable } from '@nestjs/common';
import { OcrRecognitionProvider } from '../ocr-recognition.provider';
import type { ImageSignals } from '../types';
import { GeminiExtractionService } from './gemini-extraction.service';

@Injectable()
export class GeminiProvider extends OcrRecognitionProvider {
  constructor(private extraction: GeminiExtractionService) { super(); }

  async recognize(image: Buffer): Promise<ImageSignals> {
    const document = await this.extraction.extractPreparedImage(image);
    const confidence = document.trips.reduce((sum, trip) => sum + trip.confidence_score, 0) / document.trips.length;
    return {
      read: { text: document.raw_text, lines: [], words: [], meanConfidence: confidence },
      receipt: null, structuredTrips: document.trips,
    };
  }
}
