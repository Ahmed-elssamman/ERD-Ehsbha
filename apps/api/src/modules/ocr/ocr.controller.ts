import { BadRequestException, Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { OcrService } from './ocr.service';
import { OcrExtractRequestHintsSchema, type OcrExtractRequestHints } from './dto/ocr.dto';
import { OCR_MAX_IMAGES, OCR_MAX_IMAGE_BYTES } from '@ehsbha/api-contracts';
import { OcrAdmissionGuard } from './ocr-admission.guard';

interface OcrMultipartHints { mode?: string; platform?: string }

@Controller('ocr')
@UseGuards(JwtAuthGuard, OcrAdmissionGuard)
export class OcrController {
  constructor(private readonly svc: OcrService) {}

  @Post('extract')
  @UseInterceptors(
    FilesInterceptor('images', OCR_MAX_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: OCR_MAX_IMAGE_BYTES, files: OCR_MAX_IMAGES, fields: 2, fieldSize: 32, parts: OCR_MAX_IMAGES + 2 },
    }),
  )
  async extract(
    @CurrentDriverId() _driverId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: OcrMultipartHints,
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
function parseHints(body: OcrMultipartHints): OcrExtractRequestHints {
  // Multipart form values arrive as strings; an unselected platform is sent
  // as an empty string. Normalize before validation so the Zod schema's
  // `OcrPlatformSchema.nullable()` accepts it.
  const rawPlatform = body?.platform;
  const platform =
    typeof rawPlatform === 'string' && rawPlatform.trim() === '' ? null : rawPlatform ?? null;
  const rawMode = body?.mode;
  const mode = rawMode === '' || rawMode == null ? 'auto' : rawMode;

  const parsed = OcrExtractRequestHintsSchema.safeParse({ ...body, mode, platform });
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'OCR_INVALID_HINTS',
      message: 'Invalid mode or platform',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return parsed.data;
}
