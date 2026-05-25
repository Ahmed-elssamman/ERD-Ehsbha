import sharp from 'sharp';
import { SharpProcessor } from './sharp.processor';

describe('SharpProcessor', () => {
  const proc = new SharpProcessor();

  it('processes a small generated PNG', async () => {
    const input = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 200, b: 200 } },
    }).png().toBuffer();
    const out = await proc.prepare(input);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeLessThanOrEqual(2200);
  });

  it('resizes a large image to ≤2200 longest side', async () => {
    const input = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 50, g: 50, b: 50 } },
    }).png().toBuffer();
    const out = await proc.prepare(input);
    const meta = await sharp(out).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2200);
  });

  it('throws OCR_IMAGE_INVALID on garbage', async () => {
    const garbage = Buffer.from('not an image');
    await expect(proc.prepare(garbage)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OCR_IMAGE_INVALID' }),
    });
  });
});
