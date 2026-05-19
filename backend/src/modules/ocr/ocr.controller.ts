import { Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { OcrService } from './ocr.service';

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
  ) {
    return this.svc.extract(files ?? []);
  }
}
