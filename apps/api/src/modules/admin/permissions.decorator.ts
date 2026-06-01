import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedAdmin } from './admin.types';

export const PERMISSIONS_KEY = 'admin:requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const REQUIRE_MFA_KEY = 'admin:requireMfa';
export const RequireMfa = () => SetMetadata(REQUIRE_MFA_KEY, true);

@Injectable()
export class AdminPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const requireMfa = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_MFA_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedAdmin }>();
    const admin = req.user;
    if (!admin) {
      throw new ForbiddenException({ code: 'ADMIN_UNAUTHENTICATED' });
    }

    if (requireMfa && !admin.mfaPassed) {
      throw new ForbiddenException({ code: 'ADMIN_MFA_REQUIRED' });
    }

    if (!required || required.length === 0) return true;

    const isSuper = admin.permissions.includes('*');
    const hasAll = required.every((p) => isSuper || admin.permissions.includes(p));
    if (!hasAll) {
      throw new ForbiddenException({
        code: 'ADMIN_FORBIDDEN',
        message: `Missing permission(s): ${required.join(', ')}`,
      });
    }
    return true;
  }
}
