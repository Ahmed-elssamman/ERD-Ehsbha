import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import {
  API_VERSION,
  CONTRACT_VERSION,
  FailureEnvelopeSchema,
  RESPONSE_HEADERS,
  SuccessEnvelopeSchema,
  adminAuditListItemSchema,
  adminHealthSnapshotSchema,
  adminSettingsSchema,
  adminTripsPageSchema,
  adminUsersPageSchema,
  cursorPageSchema,
} from '@ehsbha/api-contracts';
import { GlobalExceptionFilter } from '../filters/exception.filter';
import { TransformResponseInterceptor } from '../interceptors/transform-response.interceptor';
import { RequestContextMiddleware } from '../middleware/request-context.middleware';
import { AdminAuditController } from '../../modules/admin/admin-audit.controller';
import { AdminAuditQueryService } from '../../modules/admin/admin-audit.service';
import { AdminJwtAuthGuard } from '../../modules/admin/admin-jwt.guard';
import { AdminMiscController } from '../../modules/admin/admin-misc.controller';
import { AdminPermissionsGuard } from '../../modules/admin/permissions.decorator';
import { AdminSettingsController } from '../../modules/admin/admin-settings.controller';
import { AdminSettingsService } from '../../modules/admin/admin-settings.service';
import { AdminTripsController } from '../../modules/admin/admin-trips.controller';
import { AdminTripsService } from '../../modules/admin/admin-trips.service';
import { AdminUsersController } from '../../modules/admin/admin-users.controller';
import { AdminUsersService } from '../../modules/admin/admin-users.service';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { TripsController } from '../../modules/trips/trips.controller';
import { TripsService } from '../../modules/trips/trips.service';

const API_PREFIX = '/api/v1';

describe('Admin HTTP Agreement', () => {
  let app: INestApplication;

  const usersService = {
    list: jest.fn().mockResolvedValue({
      items: [{
        id: 'user-1',
        phone: '+201012345678',
        email: 'driver@example.com',
        status: 'ACTIVE',
        locale: 'ar',
        isBlacklisted: false,
        driverId: 'driver-1',
        tripCount: 4,
        createdAt: '2026-06-12T08:00:00.000Z',
        lastActivityAt: null,
      }],
      nextCursor: null,
    }),
    get: jest.fn((id: string) => {
      if (id === 'explode') {
        throw new Error('password=secret-token stack=/private/source.ts');
      }
      return { id };
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AdminUsersController,
        AdminTripsController,
        AdminAuditController,
        AdminSettingsController,
        AdminMiscController,
        TripsController,
      ],
      providers: [
        { provide: AdminUsersService, useValue: usersService },
        {
          provide: AdminTripsService,
          useValue: {
            list: jest.fn().mockResolvedValue({
              items: [{
                id: 'trip-1',
                driverId: 'driver-1',
                driverPhone: '+201012345678',
                driverDisplayName: 'Driver',
                driverAppId: 'app-1',
                appName: 'Uber',
                appCode: 'UBER',
                areaName: null,
                startedAt: '2026-06-12T08:00:00.000Z',
                endedAt: '2026-06-12T08:30:00.000Z',
                grossPiastres: 2500,
                receivedPiastres: null,
                tipPiastres: 100,
                commissionPiastres: 300,
                tollPiastres: 0,
                parkingPiastres: 0,
                totalKmMeters: 12000,
                paidKmMeters: 10000,
                emptyKmMeters: 2000,
                deletedAt: null,
              }],
              nextCursor: null,
            }),
          },
        },
        {
          provide: AdminAuditQueryService,
          useValue: {
            list: jest.fn().mockResolvedValue({
              items: [{
                id: 'audit-1',
                actorAdminId: 'admin-1',
                actorEmail: 'admin@example.com',
                actorDisplayName: 'Admin',
                actorRole: 'super_admin',
                action: 'users.view',
                targetType: 'User',
                targetId: 'user-1',
                reason: null,
                reasonCode: null,
                ip: '127.0.0.1',
                occurredAt: '2026-06-12T08:00:00.000Z',
                hasBefore: false,
                hasAfter: false,
              }],
              nextCursor: null,
            }),
          },
        },
        {
          provide: AdminSettingsService,
          useValue: {
            list: jest.fn().mockResolvedValue([{
              key: 'platform.signup_open',
              description: 'Whether signup is enabled.',
              value: true,
              isDefault: false,
              updatedAt: null,
              updatedById: null,
            }]),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { count: jest.fn().mockResolvedValue(2) },
            driver: { count: jest.fn().mockResolvedValue(1) },
            trip: { count: jest.fn().mockResolvedValue(4) },
            refreshToken: { count: jest.fn().mockResolvedValue(1) },
            adminRefreshToken: { count: jest.fn().mockResolvedValue(1) },
            supportTicket: { count: jest.fn().mockResolvedValue(0) },
          },
        },
        {
          provide: TripsService,
          useValue: {
            list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
          },
        },
      ],
    })
      .overrideGuard(AdminJwtAuthGuard)
      .useValue(authenticatedAdminGuard())
      .overrideGuard(AdminPermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticatedDriverGuard())
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

  it('uses production admin users controller and validates its envelope', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/users?limit=25`)
      .expect(200);

    expect(SuccessEnvelopeSchema(adminUsersPageSchema).safeParse(response.body).success).toBe(true);
  });

  it('propagates request IDs through the production admin trips controller', async () => {
    const requestId = 'admin-trips-request-0001';
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/trips?limit=25`)
      .set('X-Request-Id', requestId)
      .expect(200);

    expect(response.headers[RESPONSE_HEADERS.REQUEST_ID.toLowerCase()]).toBe(requestId);
    expect(response.body.meta.requestId).toBe(requestId);
    expect(SuccessEnvelopeSchema(adminTripsPageSchema).safeParse(response.body).success).toBe(true);
  });

  it('governs audit and settings responses with shared schemas', async () => {
    const auditResponse = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/audit?limit=25`)
      .expect(200);
    const settingsResponse = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/settings`)
      .expect(200);

    expect(
      SuccessEnvelopeSchema(cursorPageSchema(adminAuditListItemSchema))
        .safeParse(auditResponse.body).success,
    ).toBe(true);
    expect(
      SuccessEnvelopeSchema(adminSettingsSchema.array())
        .safeParse(settingsResponse.body).success,
    ).toBe(true);
  });

  it('uses production admin health controller and includes version metadata', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/health/snapshot`)
      .expect(200);

    expect(SuccessEnvelopeSchema(adminHealthSnapshotSchema).safeParse(response.body).success).toBe(true);
    expect(response.headers[RESPONSE_HEADERS.API_VERSION.toLowerCase()]).toBe(API_VERSION);
    expect(response.headers[RESPONSE_HEADERS.CONTRACT_VERSION.toLowerCase()]).toBe(CONTRACT_VERSION);
  });

  it('redacts stack traces, credentials, and tokens from unexpected errors', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/admin/users/explode`)
      .expect(500);
    const serialized = JSON.stringify(response.body).toLowerCase();

    expect(FailureEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('/private/source.ts');
  });

  it('isolates request IDs between real admin and driver controllers', async () => {
    const adminRequestId = 'admin-isolation-request-0001';
    const driverRequestId = 'driver-isolation-request-0001';
    const [adminResponse, driverResponse] = await Promise.all([
      request(app.getHttpServer())
        .get(`${API_PREFIX}/admin/users?limit=25`)
        .set('X-Request-Id', adminRequestId),
      request(app.getHttpServer())
        .get(`${API_PREFIX}/trips?limit=25`)
        .set('X-Request-Id', driverRequestId),
    ]);

    expect(adminResponse.body.meta.requestId).toBe(adminRequestId);
    expect(driverResponse.body.meta.requestId).toBe(driverRequestId);
  });
});

function authenticatedAdminGuard() {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = {
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Admin',
        roleCodes: ['super_admin'],
        permissions: ['*'],
        permissionsVersion: 1,
        mfaVerified: true,
      };
      return true;
    },
  };
}

function authenticatedDriverGuard() {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = {
        userId: 'user-1',
        driverId: 'driver-1',
        phone: '+201012345678',
      };
      return true;
    },
  };
}
