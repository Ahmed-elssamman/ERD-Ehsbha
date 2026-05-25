import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Preprocesses raw uploads into Azure-ready PNGs.
 *
 * Goals:
 *  1. Strip EXIF + auto-rotate so the text is upright.
 *  2. Resize down to a sensible long-edge cap. Phone screenshots can be 3-4K
 *     pixels — Azure handles them, but bytes-over-the-wire grow linearly and
 *     downscaling past ~2400px hurts OCR (text becomes fewer pixels per glyph).
 *     2200px is the sweet spot: fits dense Arabic stylized fonts and stays
 *     under Azure's 50 MB body limit by an order of magnitude.
 *  3. Light denoise + sharpen to recover edges on JPEG-compressed screenshots.
 *  4. Keep COLOR (NOT grayscale) — Image Analysis Read benefits from color
 *     channels to disambiguate fare chips, payment-method icons, and
 *     coloured-background numbers. (Tesseract preferred grayscale; Azure
 *     doesn't.)
 *  5. Output PNG-24 — lossless, predictable header byte signature for Azure.
 */
@Injectable()
export class SharpProcessor {
  private readonly logger = new Logger(SharpProcessor.name);

  async prepare(buf: Buffer): Promise<Buffer> {
    try {
      // First-pass metadata read tells us whether we're dealing with HEIC/HEIF
      // (sharp can decode these on most builds), unknown formats, or odd
      // orientations. We let `.rotate()` apply EXIF orientation, then resize.
      const pipeline = sharp(buf, { failOn: 'error', sequentialRead: true })
        .rotate()
        .resize({
          width: 2200,
          height: 2200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        // Median is a gentle denoise that removes JPEG mosquito noise without
        // smearing text. Kernel size 1 = nearest-neighbour median (very mild).
        .median(1)
        // Linear contrast boost: pull near-black darker and near-white whiter.
        // a > 1 widens dynamic range, b shifts the midpoint. These values were
        // chosen so dark-mode Uber/Careem screens (very low local contrast)
        // come out crisper without clipping the bright "amount" digits.
        .linear(1.08, -8)
        // Sharpen with a small sigma to recover thin Arabic strokes (ج, خ, ح)
        // that resize attenuates. Heavier sharpening creates haloing that
        // hurts OCR confidence.
        .sharpen({ sigma: 0.6 })
        .toFormat('png', { compressionLevel: 9, adaptiveFiltering: true });

      return await pipeline.toBuffer();
    } catch (err) {
      this.logger.warn(`sharp.prepare failed: ${(err as Error).message}`);
      throw new BadRequestException({
        code: 'OCR_IMAGE_INVALID',
        message: 'Unable to decode the uploaded image',
      });
    }
  }
}
