import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { OCR_DECODED_FORMATS, OCR_MAX_IMAGE_EDGE, OCR_MAX_INPUT_PIXELS } from '../ocr.control';

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
  async prepare(buf: Buffer): Promise<Buffer> {
    try {
      // First-pass metadata read tells us whether we're dealing with HEIC/HEIF
      // (sharp can decode these on most builds), unknown formats, or odd
      // orientations. We let `.rotate()` apply EXIF orientation, then resize.
      const input = sharp(buf, { failOn: 'warning', limitInputPixels: OCR_MAX_INPUT_PIXELS, sequentialRead: true });
      const metadata = await input.metadata();
      if (!metadata.format || !OCR_DECODED_FORMATS.has(metadata.format)
        || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height
        || metadata.width > OCR_MAX_IMAGE_EDGE || metadata.height > OCR_MAX_IMAGE_EDGE) {
        throw new Error('Unsupported image content');
      }
      const pipeline = input
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
    } catch {
      throw new BadRequestException({
        code: 'OCR_IMAGE_INVALID',
        message: 'Unable to decode the uploaded image',
      });
    }
  }
}
