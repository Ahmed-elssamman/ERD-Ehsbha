import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'debug', 'warn', 'error', 'verbose'],
  });

  app.setGlobalPrefix('api/v1');

  const origins = env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`Ehsbha API listening on http://localhost:${env.PORT}/api/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
