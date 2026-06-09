import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import request from 'supertest';

const API_PREFIX = '/api/v1';
const { checkEnvironment } = require('../../../../../scripts/verification/lib/environment-safety.cjs') as {
  checkEnvironment: (env: Record<string, string | undefined>) => { safe: boolean };
};

describe('Health Integration (database safety)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unsafe database names via shared safety guard', async () => {
    const safe1 = checkEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/ehsbha_test_valid',
    });
    expect(safe1.safe).toBe(true);

    const safe2 = checkEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/production_db',
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
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/ehsbha_test_valid',
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
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app.getHttpServer())
      .get(`${API_PREFIX}/ready`)
      .expect(503);

    expect(res.body.status).toBe('not-ready');
    expect(res.body.db).toBe('down');
  });
});
