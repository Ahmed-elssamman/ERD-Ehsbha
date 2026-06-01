import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  driverId: string | null;
  phone: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);

export const CurrentDriverId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user?.driverId) {
      throw new Error('No driver attached to user — finish onboarding first');
    }
    return user.driverId;
  },
);
