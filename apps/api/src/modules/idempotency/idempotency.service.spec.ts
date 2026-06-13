import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { IdempotencyStatus, type IdempotencyRecord } from '@prisma/client';
import { IdempotencyRepository } from './idempotency.repository';
import { canonicalJson, IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const repository = {
    claim: jest.fn(),
    complete: jest.fn(),
    markRetryableFailure: jest.fn(),
  };
  let service: IdempotencyService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: IdempotencyRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(IdempotencyService);
  });

  it('hashes equivalent validated payloads identically', () => {
    expect(service.hashRequest({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(service.hashRequest({ a: { c: 3, d: 4 }, b: 2 }));
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('claims a new scoped key for execution', async () => {
    repository.claim.mockResolvedValue({
      kind: 'claimed',
      record: record({ requestHash: service.hashRequest({ amount: 1 }) }),
    });

    await expect(service.begin(scope(), { amount: 1 })).resolves.toMatchObject({
      kind: 'execute',
      recordId: 'idem_1',
    });
  });

  it('replays the completed response for the same key and payload', async () => {
    repository.claim.mockResolvedValue({
      kind: 'existing',
      record: record({
        requestHash: service.hashRequest({ amount: 1 }),
        status: IdempotencyStatus.COMPLETED,
        responseStatus: 201,
        responseBody: { data: { id: 'trip_1' } },
        completedAt: new Date(),
      }),
    });

    await expect(service.begin(scope(), { amount: 1 })).resolves.toEqual({
      kind: 'replay',
      response: { status: 201, body: { data: { id: 'trip_1' } } },
    });
  });

  it('rejects reuse of a key with a different payload', async () => {
    repository.claim.mockResolvedValue({
      kind: 'existing',
      record: record({ requestHash: service.hashRequest({ amount: 1 }) }),
    });

    await expect(service.begin(scope(), { amount: 2 })).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });

  it('rejects a concurrent request while the first execution is in progress', async () => {
    repository.claim.mockResolvedValue({
      kind: 'existing',
      record: record({ requestHash: service.hashRequest({ amount: 1 }) }),
    });

    await expect(service.begin(scope(), { amount: 1 })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.begin(scope(), { amount: 1 })).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_IN_PROGRESS' },
    });
  });

  it('rejects sensitive and oversized replay payloads', async () => {
    await expect(service.complete('idem_1', 200, { accessToken: 'secret' }))
      .rejects.toThrow('forbidden field');
    await expect(service.complete('idem_1', 200, { value: 'x'.repeat(70 * 1024) }))
      .rejects.toThrow('64 KiB');
    expect(repository.complete).not.toHaveBeenCalled();
  });
});

function scope() {
  return {
    realm: 'driver' as const,
    actorId: 'driver_1',
    operationId: 'driver.trips.create',
    key: 'request-0001',
  };
}

function record(overrides: Partial<IdempotencyRecord>): IdempotencyRecord {
  return {
    id: 'idem_1',
    realm: 'driver',
    actorId: 'driver_1',
    operationId: 'driver.trips.create',
    key: 'request-0001',
    requestHash: '0'.repeat(64),
    status: IdempotencyStatus.IN_PROGRESS,
    responseStatus: null,
    responseBody: null,
    resourceType: null,
    resourceId: null,
    createdAt: new Date(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}
