import sharp from 'sharp';
import { SharpProcessor } from './sharp.processor';

describe('SharpProcessor', () => {
  const proc = new SharpProcessor();

  it('rejects SVG content even when submitted as a supported MIME', async () => {
    const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>');
    await expect(proc.prepare(image)).rejects.toMatchObject({ response: { code: 'OCR_IMAGE_INVALID' } });
  });

  it('rejects truncated image payloads after reading their headers', async () => {
    const input = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#999' } }).png().toBuffer();
    await expect(proc.prepare(input.subarray(0, Math.floor(input.length / 2)))).rejects.toMatchObject({ response: { code: 'OCR_IMAGE_INVALID' } });
  });

  it('rejects oversized pixel dimensions in a compact upload', async () => {
    const input = await sharp({ create: { width: 8000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(proc.prepare(input)).rejects.toMatchObject({ response: { code: 'OCR_IMAGE_INVALID' } });
  });

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
