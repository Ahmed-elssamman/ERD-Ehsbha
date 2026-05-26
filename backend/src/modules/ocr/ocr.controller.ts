import { BadRequestException, Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { OcrService } from './ocr.service';
import { OcrExtractRequestHintsSchema, type OcrExtractRequestHints } from './dto/ocr.dto';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly svc: OcrService) {}

  @Post('extract')
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES, files: MAX_FILES },
    }),
  )
  async extract(
    @CurrentDriverId() _driverId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: Record<string, unknown>,
  ) {
    const hints = parseHints(body);
    return this.svc.extract(files ?? [], hints);
  }
}

/**
 * Reads the optional `mode` and `platform` multipart form fields the upload
 * UI now sends, validates them through the Zod schema, and surfaces a 400
 * with a stable error code when the driver picks an unsupported value.
 */
function parseHints(body: Record<string, unknown>): OcrExtractRequestHints {
  // Multipart form values arrive as strings; an unselected platform is sent
  // as an empty string. Normalize before validation so the Zod schema's
  // `OcrPlatformSchema.nullable()` accepts it.
  const rawPlatform = body?.platform;
  const platform =
    typeof rawPlatform === 'string' && rawPlatform.trim() === '' ? null : rawPlatform ?? null;
  const rawMode = body?.mode;
  const mode = typeof rawMode === 'string' && rawMode.trim() !== '' ? rawMode : undefined;

  const parsed = OcrExtractRequestHintsSchema.safeParse({ mode, platform });
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'OCR_INVALID_HINTS',
      message: 'Invalid mode or platform',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return parsed.data;
}
