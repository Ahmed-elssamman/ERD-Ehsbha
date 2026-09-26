import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  OCR_MAX_IMAGE_BYTES, createOcrImportRequestSchema, ocrImportListQuerySchema,
  ocrConfirmationRequestSchema, type OcrConfirmationRequest,
  type CreateOcrImportRequest, type OcrImportListQuery,
} from '@ehsbha/api-contracts';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod.pipe';
import { OcrImportStore } from './ocr-import-store.service';
import { OcrImportUploadGuard } from './ocr-import-upload.guard';
import { OcrConfirmationService } from './ocr-confirmation.service';

@Controller('ocr/imports')
@UseGuards(JwtAuthGuard)
export class OcrImportController {
  constructor(private store: OcrImportStore, private confirmations: OcrConfirmationService) {}

  @Post(':id/confirm')
  confirm(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(ocrConfirmationRequestSchema)) request: OcrConfirmationRequest) {
    return this.confirmations.confirm(driverId, id, request);
  }

  @Post()
  create(@CurrentDriverId() driverId: string, @Body(new ZodValidationPipe(createOcrImportRequestSchema)) request: CreateOcrImportRequest) {
    return this.store.create(driverId, request);
  }

  @Get()
  list(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(ocrImportListQuerySchema)) query: OcrImportListQuery) {
    return this.store.list(driverId, query);
  }

  @Get(':id')
  get(@CurrentDriverId() driverId: string, @Param('id') id: string) { return this.store.get(driverId, id); }

  @Post(':id/images/:imageId')
  @UseGuards(OcrImportUploadGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(), limits: { fileSize: OCR_MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
  }))
  upload(@CurrentDriverId() driverId: string, @Param('id') id: string, @Param('imageId') imageId: string, @UploadedFile() image?: Express.Multer.File) {
    return this.store.upload(driverId, id, imageId, image ?? null);
  }

  @Delete(':id')
  cancel(@CurrentDriverId() driverId: string, @Param('id') id: string) { return this.store.cancel(driverId, id); }
}
