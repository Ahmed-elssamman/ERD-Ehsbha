import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';
import { OcrRecognitionProvider } from '../src/modules/ocr/ocr-recognition.provider';
import type { ImageSignals } from '../src/modules/ocr/types';

interface EnvironmentSafety {
  checkEnvironment(environment: NodeJS.ProcessEnv): { safe: boolean };
}
const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as EnvironmentSafety;

/** Only cloud recognition is substituted. Image decoding, parsing, auth and storage are real. */
class BrowserRecognitionFixture extends OcrRecognitionProvider {
  override async recognize(): Promise<ImageSignals> {
    const text = 'Uber\nالأجرة 85.00 ج.م.';
    const lines = text.split('\n').map((line, index) => ({
      text: line, meanConfidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 },
      words: [{ text: line, confidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 } }],
    }));
    return { read: { text, lines, words: lines.flatMap((line) => line.words), meanConfidence: 0.98 }, receipt: null };
  }
}

async function start(): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || !checkEnvironment(process.env).safe) {
    throw new Error('Browser integration requires NODE_ENV=test and a disposable ehsbha_test_ database');
  }
  Object.defineProperty(BigInt.prototype, 'toJSON', { value: function (this: bigint): number { return Number(this); }, configurable: true });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OcrRecognitionProvider).useClass(BrowserRecognitionFixture).compile();
  const app = module.createNestApplication({ logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));
  app.enableCors({ origin: 'http://127.0.0.1:5188', credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor(), app.get(IdempotencyInterceptor));
  app.enableShutdownHooks();
  await app.listen(55443, '127.0.0.1');
}

void start().catch(() => { process.stderr.write('Browser integration API could not start. Check disposable test prerequisites.\n'); process.exitCode = 1; });
