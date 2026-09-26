import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { reportContentSchema } from '@ehsbha/api-contracts';
import { reportPeriodRange } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { ReportDeliveryService } from '../src/modules/reports/report-delivery.service';

interface EnvironmentSafety { checkEnvironment(environment: NodeJS.ProcessEnv): { safe: boolean } }
const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as EnvironmentSafety;

async function deliver(): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || !checkEnvironment(process.env).safe) throw new Error('Report browser fixture requires a disposable test database');
  const reportId = process.argv[2];
  if (!reportId) throw new Error('Report ID required');
  const database = new PrismaClient();
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, AggregatesService, ReportDeliveryService] }).compile();
  try {
    const report = await database.driverReport.findUniqueOrThrow({ where: { id: reportId } }), content = reportContentSchema.parse(report.content);
    const range = reportPeriodRange(content.period, content.startsOn);
    const id = await module.get(ReportDeliveryService).deliver(report.driverId, content.period, new Date(`${range.nextStartsOn}T09:00:00Z`));
    if (!id) throw new Error('Expected report delivery');
  } finally { await module.close(); await database.$disconnect(); }
}
void deliver().catch((error: Error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
