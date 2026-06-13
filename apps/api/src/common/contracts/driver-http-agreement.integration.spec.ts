import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import {
  API_VERSION,
  CONTRACT_VERSION,
  EmptySuccessDataSchema,
  RESPONSE_HEADERS,
  type OcrExtractResponse,
  SuccessEnvelopeSchema,
  communityListResponseSchema,
  driverVehicleSchema,
  lookupEmailResultSchema,
  ocrExtractResponseSchema,
  tripsListResponseSchema,
} from '@ehsbha/api-contracts';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { CommunityController } from '../../modules/community/community.controller';
import { CommunityService } from '../../modules/community/community.service';
import { OcrController } from '../../modules/ocr/ocr.controller';
import { OcrService } from '../../modules/ocr/ocr.service';
import { TripsController } from '../../modules/trips/trips.controller';
import { TripsService } from '../../modules/trips/trips.service';
import { VehiclesController } from '../../modules/vehicles/vehicles.controller';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
import { GlobalExceptionFilter } from '../filters/exception.filter';
import { TransformResponseInterceptor } from '../interceptors/transform-response.interceptor';
import { RequestContextMiddleware } from '../middleware/request-context.middleware';

const API_PREFIX = '/api/v1';
const DRIVER_ID = 'driver-http-agreement';

describe('Driver HTTP Agreement', () => {
  let app: INestApplication;

  const trip = {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    driverAppId: 'app-1',
    areaId: null,
    startedAt: '2026-06-12T08:00:00.000Z',
    endedAt: '2026-06-12T08:30:00.000Z',
    grossPiastres: 2500,
    tipPiastres: 100,
    commissionPiastres: 300,
    tollPiastres: 0,
    parkingPiastres: 0,
    totalKmMeters: 12000,
    paidKmMeters: 10000,
    emptyKmMeters: 2000,
    notes: null,
  };
  const vehicle = {
    id: 'vehicle-1',
    type: 'CAR',
    make: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'PETROL_92',
    tankLiters: 45,
    baselineKmPerLiter: 12,
    odometerMeters: 80000,
    isActive: true,
  };
  const ocrResult: OcrExtractResponse = {
    platform: 'UBER',
    platformConfidence: 0.95,
    mode: 'single',
    parsed: {
      vehicleType: null,
      appHint: 'Uber',
      startedAt: null,
      endedAt: null,
      durationSec: null,
      grossEgp: 25,
      receivedEgp: null,
      tipEgp: null,
      commissionEgp: null,
      tollEgp: null,
      parkingEgp: null,
      waitingFeeEgp: null,
      totalKm: 12,
      paidKm: null,
      pickup: null,
      destination: null,
      paymentMethod: 'unknown',
      notes: null,
    },
    fieldConfidences: { grossEgp: 0.95 },
    trips: [],
    warnings: [],
    imageHashes: [],
    rawTextLengths: [],
    ocrMeanConfidence: 0.95,
  };
  ocrResult.trips.push({
    parsed: ocrResult.parsed,
    fieldConfidences: ocrResult.fieldConfidences,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        TripsController,
        VehiclesController,
        OcrController,
        CommunityController,
      ],
      providers: [
        {
          provide: AuthService,
          useValue: {
            lookupEmailByPhone: jest.fn().mockResolvedValue({
              phone: '+201012345678',
              emailMasked: 'd***r@example.com',
            }),
          },
        },
        {
          provide: TripsService,
          useValue: {
            list: jest.fn().mockResolvedValue({ items: [trip], nextCursor: null }),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: VehiclesService,
          useValue: {
            list: jest.fn().mockResolvedValue([vehicle]),
          },
        },
        {
          provide: OcrService,
          useValue: {
            extract: jest.fn().mockResolvedValue(ocrResult),
          },
        },
        {
          provide: CommunityService,
          useValue: {
            list: jest.fn().mockResolvedValue({
              items: [{
                id: 'post-1',
                category: 'GENERAL',
                title: 'Route advice',
                body: 'Use the ring road before rush hour.',
                likeCount: 4,
                dislikeCount: 0,
                createdAt: '2026-06-12T08:00:00.000Z',
                author: { id: DRIVER_ID, displayName: 'Driver', baseCity: 'Cairo' },
                myReaction: null,
                isOwn: true,
              }],
              nextCursor: null,
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = {
            userId: 'user-http-agreement',
            driverId: DRIVER_ID,
            phone: '+201012345678',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    const contextMiddleware = new RequestContextMiddleware();
    app.use((req: Request, res: Response, next: NextFunction) => contextMiddleware.use(req, res, next));
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses production auth controller and returns governed metadata headers', async () => {
    const requestId = 'driver-auth-request-0001';
    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/password/lookup`)
      .set('X-Request-Id', requestId)
      .send({ phone: '01012345678' })
      .expect(200);

    expectAgreement(response, requestId);
    expect(SuccessEnvelopeSchema(lookupEmailResultSchema).safeParse(response.body).success).toBe(true);
  });

  it('uses production trips controller and validates its shared response contract', async () => {
    const requestId = 'driver-trips-request-0001';
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/trips?limit=25`)
      .set('X-Request-Id', requestId)
      .expect(200);

    expectAgreement(response, requestId);
    expect(SuccessEnvelopeSchema(tripsListResponseSchema).safeParse(response.body).success).toBe(true);
  });

  it('normalizes production 204 controllers to a metadata-bearing success envelope', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${API_PREFIX}/trips/trip-1`)
      .set('X-Request-Id', 'driver-delete-request-0001')
      .expect(200);

    expect(SuccessEnvelopeSchema(EmptySuccessDataSchema).safeParse(response.body).success).toBe(true);
  });

  it('uses production OCR controller and validates the shared OCR response', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/ocr/extract`)
      .field('mode', 'single')
      .field('platform', 'UBER')
      .expect(201);

    expectAgreement(response, response.body.meta.requestId);
    expect(SuccessEnvelopeSchema(ocrExtractResponseSchema).safeParse(response.body).success).toBe(true);
  });

  it('uses production vehicles controller and validates the shared response', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/vehicles`)
      .expect(200);

    expect(SuccessEnvelopeSchema(driverVehicleSchema.array()).safeParse(response.body).success).toBe(true);
  });

  it('uses production community controller and validates pagination and metadata', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/community/posts?limit=25`)
      .expect(200);

    expect(SuccessEnvelopeSchema(communityListResponseSchema).safeParse(response.body).success).toBe(true);
  });
});

function expectAgreement(
  response: request.Response,
  requestId: string,
): void {
  expect(response.headers[RESPONSE_HEADERS.REQUEST_ID.toLowerCase()]).toBe(requestId);
  expect(response.headers[RESPONSE_HEADERS.API_VERSION.toLowerCase()]).toBe(API_VERSION);
  expect(response.headers[RESPONSE_HEADERS.CONTRACT_VERSION.toLowerCase()]).toBe(CONTRACT_VERSION);
  expect(response.body.meta).toMatchObject({
    requestId,
    apiVersion: API_VERSION,
    contractVersion: CONTRACT_VERSION,
  });
}
