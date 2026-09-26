import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { OcrImportStore } from './ocr-import-store.service';
import { OCR_MAX_ACTIVE_UPLOADS } from '../ocr.control';
import { OCR_IMPORT_UPLOADS_PER_WINDOW, OCR_IMPORT_UPLOAD_WINDOW_MS } from './ocr-import.control';

interface ImportUploadRequest extends Request { user: AuthUser; params: { id: string; imageId: string } }
interface ImportUploadWindow { requests: number; expiresAt: number }

/** Authorize the document and reserve memory before the multipart interceptor. */
@Injectable()
export class OcrImportUploadGuard implements CanActivate {
  private active = 0;
  private drivers = new Set<string>();
  private windows = new Map<string, ImportUploadWindow>();
  constructor(private store: OcrImportStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ImportUploadRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const driverId = request.user?.driverId;
    if (!driverId) throw new HttpException({ code: 'UNAUTHENTICATED' }, HttpStatus.UNAUTHORIZED);
    await this.store.assertUploadOwner(driverId, request.params.id, request.params.imageId);
    const now = Date.now();
    for (const [id, window] of this.windows) if (window.expiresAt <= now) this.windows.delete(id);
    const window = this.windows.get(driverId) ?? { requests: 0, expiresAt: now + OCR_IMPORT_UPLOAD_WINDOW_MS };
    if (this.active >= OCR_MAX_ACTIVE_UPLOADS || this.drivers.has(driverId) || window.requests >= OCR_IMPORT_UPLOADS_PER_WINDOW) {
      response.setHeader('Retry-After', window.requests >= OCR_IMPORT_UPLOADS_PER_WINDOW ? Math.max(1, Math.ceil((window.expiresAt - now) / 1000)) : 5);
      throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    window.requests += 1;
    this.windows.set(driverId, window);
    this.active += 1;
    this.drivers.add(driverId);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.drivers.delete(driverId);
    };
    response.once('finish', release);
    response.once('close', release);
    return true;
  }
}
