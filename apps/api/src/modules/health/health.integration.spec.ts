import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import request from 'supertest';

const API_PREFIX = '/api/v1';
const { checkEnvironment } = require('../../../../../scripts/verification/lib/environment-safety.cjs') as {
  checkEnvironment: (env: NodeJS.ProcessEnv) => { safe: boolean };
};

describe('Health HTTP boundary and database safety', () => {
  let app: INestApplication;
  const database = { $queryRaw: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: database }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    database.$queryRaw.mockReset();
    database.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('rejects unsafe database names via shared safety guard', async () => {
    const safe1 = checkEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@ep-health-safe-pooler.c-7.us-east-1.aws.neon.tech/ehsbha_test_valid?sslmode=require',
    });
    expect(safe1.safe).toBe(true);

    const safe2 = checkEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@ep-health-safe-pooler.c-7.us-east-1.aws.neon.tech/production_db?sslmode=require',
    });
    expect(safe2.safe).toBe(false);
  });

  it('refuses destructive operations in production mode via shared guard', async () => {
    const safe1 = checkEnvironment({ NODE_ENV: 'production', DATABASE_URL: '' });
    expect(safe1.safe).toBe(false);

    const safe2 = checkEnvironment({ NODE_ENV: 'development', DATABASE_URL: '' });
    expect(safe2.safe).toBe(false);

    const safe3 = checkEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@ep-health-safe-pooler.c-7.us-east-1.aws.neon.tech/ehsbha_test_valid?sslmode=require',
    });
    expect(safe3.safe).toBe(true);
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API_PREFIX}/health`)
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/v1/ready returns ready when database is up', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API_PREFIX}/ready`)
      .expect(200);

    expect(res.body.status).toBe('ready');
    expect(res.body.db).toBe('up');
  });

  it('GET /api/v1/ready returns not-ready when database is down', async () => {
    database.$queryRaw.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app.getHttpServer())
      .get(`${API_PREFIX}/ready`)
      .expect(503);

    expect(res.body.status).toBe('not-ready');
    expect(res.body.db).toBe('down');
  });
});
