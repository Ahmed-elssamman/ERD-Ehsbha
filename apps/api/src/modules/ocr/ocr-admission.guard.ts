import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { OCR_MAX_ACTIVE_UPLOADS, OCR_REQUESTS_PER_WINDOW, OCR_REQUEST_WINDOW_MS } from './ocr.control';

interface OcrRequest extends Request { user: AuthUser }
interface UploadWindow { active: boolean; requests: number; expiresAt: number }

/** Reserve upload capacity before Multer allocates buffers. Limits are per API process. */
@Injectable()
export class OcrAdmissionGuard implements CanActivate {
  private active = 0;
  private drivers = new Map<string, UploadWindow>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OcrRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const driverId = request.user?.driverId;
    if (!driverId) throw new HttpException({ code: 'UNAUTHENTICATED' }, HttpStatus.UNAUTHORIZED);
    const now = Date.now();
    for (const [id, window] of this.drivers) {
      if (!window.active && window.expiresAt <= now) this.drivers.delete(id);
    }
    const window = this.drivers.get(driverId) ?? { active: false, requests: 0, expiresAt: now + OCR_REQUEST_WINDOW_MS };
    if (this.active >= OCR_MAX_ACTIVE_UPLOADS || window.active || window.requests >= OCR_REQUESTS_PER_WINDOW) {
      response.setHeader('Retry-After', window.requests >= OCR_REQUESTS_PER_WINDOW ? Math.max(1, Math.ceil((window.expiresAt - now) / 1000)) : 5);
      throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    window.active = true;
    window.requests += 1;
    this.drivers.set(driverId, window);
    this.active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      window.active = false;
      this.active -= 1;
    };
    response.once('finish', release);
    response.once('close', release);
    return true;
  }
}
