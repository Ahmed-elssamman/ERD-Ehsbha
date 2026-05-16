import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['warn', 'error'],
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
        this.logger.log(`Prisma connected (attempt ${attempt + 1})`);
        return;
      } catch (err) {
        const isLast = attempt === maxAttempts - 1;
        const msg = (err as Error).message?.slice(0, 100) ?? 'unknown';
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
}
