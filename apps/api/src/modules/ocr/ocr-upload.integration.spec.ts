import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request } from 'express';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GlobalExceptionFilter } from '../../common/filters/exception.filter';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

interface AuthRequest extends Request { user: AuthUser }

describe('OCR authenticated multipart boundary', () => {
  let app: INestApplication;
  const extract = jest.fn().mockResolvedValue({ trips: [] });
  beforeEach(async () => {
    extract.mockClear();
    const module = await Test.createTestingModule({ controllers: [OcrController], providers: [{ provide: OcrService, useValue: { extract } }] })
      .overrideGuard(JwtAuthGuard).useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<AuthRequest>();
          const driverId = req.get('x-test-driver');
          if (!driverId) throw new UnauthorizedException();
          req.user = { userId: driverId, driverId, phone: '+201000000001' };
          return true;
        },
      }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('requires authentication before accepting an image', async () => {
    await request(app.getHttpServer()).post('/ocr/extract').attach('images', Buffer.from('test'), 'trip.png').expect(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it('accepts twenty images with automatic hints', async () => {
    let upload = request(app.getHttpServer()).post('/ocr/extract').set('x-test-driver', 'driver-a');
    for (let index = 0; index < 20; index++) upload = upload.attach('images', Buffer.from('test'), `trip-${index}.png`);
    await upload.expect(201);
    expect(extract).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ mimetype: 'image/png' })]), { mode: 'auto', platform: null });
    expect(extract.mock.calls[0][0]).toHaveLength(20);
  });

  it('rejects extra fields and invalid hints through governed validation errors', async () => {
    const response = await request(app.getHttpServer()).post('/ocr/extract').set('x-test-driver', 'driver-a').field('extra', 'value').expect(400);
    expect(response.body.error.code).toBe('OCR_INVALID_HINTS');
    expect(extract).not.toHaveBeenCalled();
  });

  it('limits repeated uploads per driver without blocking another driver', async () => {
    for (let index = 0; index < 12; index++) await request(app.getHttpServer()).post('/ocr/extract').set('x-test-driver', 'driver-a').expect(201);
    const limited = await request(app.getHttpServer()).post('/ocr/extract').set('x-test-driver', 'driver-a').expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    await request(app.getHttpServer()).post('/ocr/extract').set('x-test-driver', 'driver-b').expect(201);
  });
});
