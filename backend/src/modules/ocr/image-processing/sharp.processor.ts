import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class SharpProcessor {
  private readonly logger = new Logger(SharpProcessor.name);

  async prepare(buf: Buffer): Promise<Buffer> {
    try {
      return await sharp(buf, { failOn: 'error', sequentialRead: true })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1 })
        .toFormat('png')
        .toBuffer();
    } catch (err) {
      this.logger.warn(`sharp.prepare failed: ${(err as Error).message}`);
      throw new BadRequestException({
        code: 'OCR_IMAGE_INVALID',
        message: 'Unable to decode the uploaded image',
      });
    }
  }
}
