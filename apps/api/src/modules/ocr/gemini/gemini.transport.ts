import { Injectable } from '@nestjs/common';
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';

@Injectable()
export class GeminiTransport {
  generate(apiKey: string, request: GenerateContentParameters): Promise<GenerateContentResponse> {
    return new GoogleGenAI({ apiKey }).models.generateContent(request);
  }
}
