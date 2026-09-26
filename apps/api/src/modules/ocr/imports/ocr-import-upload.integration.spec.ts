import { ExecutionContext, INestApplication, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request } from 'express';
import { OcrImportController } from './ocr-import.controller';
import { OcrImportStore } from './ocr-import-store.service';
import { OcrConfirmationService } from './ocr-confirmation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GlobalExceptionFilter } from '../../../common/filters/exception.filter';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

interface AuthRequest extends Request { user: AuthUser }

describe('persisted OCR import upload boundary', () => {
  let app: INestApplication;
  const upload = jest.fn().mockResolvedValue({ id: 'batch' });
  const assertUploadOwner = jest.fn(async (driverId: string, batchId: string, imageId: string) => {
    if (driverId !== 'driver-a' || batchId !== 'batch' || imageId !== 'image') throw new NotFoundException({ code: 'NOT_FOUND' });
  });
  beforeEach(async () => {
    upload.mockClear(); assertUploadOwner.mockClear();
    const module = await Test.createTestingModule({ controllers: [OcrImportController], providers: [
      { provide: OcrImportStore, useValue: { upload, assertUploadOwner } },
      { provide: OcrConfirmationService, useValue: {} },
    ] }).overrideGuard(JwtAuthGuard).useValue({
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

  it('checks authentication and image ownership before parsing multipart content', async () => {
    await request(app.getHttpServer()).post('/ocr/imports/batch/images/image').attach('image', Buffer.from('test'), 'trip.png').expect(401);
    expect(assertUploadOwner).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post('/ocr/imports/batch/images/image').set('x-test-driver', 'driver-b').attach('image', Buffer.from('test'), 'trip.png').expect(404);
    expect(upload).not.toHaveBeenCalled();
  });
  it('accepts twenty separate images and replays without consuming a per-image request budget', async () => {
    for (let index = 0; index < 21; index++) {
      await request(app.getHttpServer()).post('/ocr/imports/batch/images/image').set('x-test-driver', 'driver-a').attach('image', Buffer.from('test'), 'trip.png').expect(201);
    }
    expect(upload).toHaveBeenCalledTimes(21);
    expect(upload).toHaveBeenLastCalledWith('driver-a', 'batch', 'image', expect.objectContaining({ mimetype: 'image/png', size: 4 }));
  });
  it('rejects additional fields and images before the store can write them', async () => {
    await request(app.getHttpServer()).post('/ocr/imports/batch/images/image').set('x-test-driver', 'driver-a').field('driverId', 'driver-b').attach('image', Buffer.from('test'), 'trip.png').expect(400);
    await request(app.getHttpServer()).post('/ocr/imports/batch/images/image').set('x-test-driver', 'driver-a').attach('image', Buffer.from('test'), 'trip.png').attach('image', Buffer.from('test'), 'extra.png').expect(400);
    expect(upload).not.toHaveBeenCalled();
  });
});
