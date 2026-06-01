import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedAdmin } from './admin.types';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedAdmin }>();
    if (!req.user) throw new Error('CurrentAdmin used without AdminJwtAuthGuard');
    return req.user;
  },
);
