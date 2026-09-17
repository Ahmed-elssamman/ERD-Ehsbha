import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isPrismaConnectivityError, summarizePrismaConnectivityError } from './prisma-errors';
import { describePrismaRuntimeMode } from './database-url';
import { createPrismaClientOptions } from './client-options';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly runtimeRetryDelays = [750, 1500];
  private readonly datasourceMode = describePrismaRuntimeMode();

  constructor() {
    super({
      ...createPrismaClientOptions(),
      // Avoid Prisma's raw engine stderr output; we log sanitized connectivity
      // failures ourselves from the retry paths below.
      log: [],
    });
  }

  /**
   * Connect with retries — important for serverless Postgres providers like Neon
   * that auto-suspend after inactivity and take a few seconds to wake up.
   * If all retries fail, the app still boots and Prisma reconnects lazily.
   */
  async onModuleInit(): Promise<void> {
    const maxAttempts = 5;
    const delays = [500, 1500, 3000, 5000, 8000];
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log(`Prisma connected via ${this.datasourceMode} URL (attempt ${attempt + 1})`);
        return;
      } catch (err) {
        const isLast = attempt === maxAttempts - 1;
        const msg = summarizePrismaConnectivityError(err).slice(0, 160);
        if (isLast) {
          this.logger.warn(
            `Prisma failed to connect after ${maxAttempts} attempts. ` +
            `App will still boot; DB will be reached lazily on first query. Last error: ${msg}`,
          );
          return;
        }
        const delay = delays[attempt];
        this.logger.warn(
          `Prisma connection attempt ${attempt + 1}/${maxAttempts} failed (${msg}). Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      // Ignore disconnect errors on shutdown.
    }
  }

  async withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
    for (let attempt = 0; attempt <= this.runtimeRetryDelays.length; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!isPrismaConnectivityError(error) || attempt === this.runtimeRetryDelays.length) {
          throw error;
        }

        const delay = this.runtimeRetryDelays[attempt];
        this.logger.warn(
          `Transient database connectivity failure during ${label}. ` +
          `Retrying in ${delay}ms (${summarizePrismaConnectivityError(error)}).`,
        );

        await this.reconnect(delay);
      }
    }

    throw new Error('Prisma query retry unexpectedly exhausted');
  }

  async reconnect(delay = 0): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      // Ignore disconnect errors while resetting the client.
    }

    if (delay > 0) {
      await sleep(delay);
    }

    try {
      await this.$connect();
    } catch {
      // Ignore reconnect errors here and let the next query attempt surface them.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
