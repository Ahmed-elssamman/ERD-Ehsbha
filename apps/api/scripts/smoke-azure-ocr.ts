/**
 * Connectivity smoke test for the Azure OCR pipeline.
 *
 * Generates a tiny synthetic PNG with the text "Hello 123" rendered on it
 * via `sharp.composite()` and pipes it through the full stack:
 *
 *   sharp prepare → AzureVisionClient.read → AzureDocumentIntelligenceClient
 *
 * Prints the recognized lines + Document Intelligence outcome. Useful as a
 * one-shot health check after rotating keys or switching regions:
 *
 *   $ npm --workspace backend run smoke:ocr
 *
 * Requires AZURE_VISION_ENDPOINT + AZURE_VISION_KEY in .env.
 */
import sharp from 'sharp';
import { SharpProcessor } from '../src/modules/ocr/image-processing/sharp.processor';
import { AzureVisionClient } from '../src/modules/ocr/azure/azure-vision.client';
import { AzureDocumentIntelligenceClient } from '../src/modules/ocr/azure/azure-document-intelligence.client';

async function makeSyntheticImage(): Promise<Buffer> {
  // 800x300 white canvas with simple SVG text overlay. Azure Read handles
  // SVG-rendered text well — enough to verify the wire format, not enough to
  // exercise Arabic-font accuracy (that needs real screenshots).
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300">
       <rect width="800" height="300" fill="white"/>
       <text x="50" y="120" font-family="Arial" font-size="56" fill="black">Ehsbha OCR smoke</text>
       <text x="50" y="200" font-family="Arial" font-size="48" fill="black">Total: 27.04 EGP</text>
     </svg>`,
  );
  return sharp({
    create: { width: 800, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const sharpProc = new SharpProcessor();
  const reader = new AzureVisionClient();
  const di = new AzureDocumentIntelligenceClient();

  const raw = await makeSyntheticImage();
  console.log(`[smoke] synthetic png: ${raw.byteLength} bytes`);

  const prepared = await sharpProc.prepare(raw);
  console.log(`[smoke] prepared png: ${prepared.byteLength} bytes`);

  console.log('[smoke] calling Azure Read…');
  const read = await reader.read(prepared);
  console.log(
    `[smoke] Read: ${read.lines.length} lines, meanConfidence=${read.meanConfidence.toFixed(3)}`,
  );
  for (const line of read.lines) {
    console.log(`  · "${line.text}" (conf ${line.meanConfidence.toFixed(2)})`);
  }

  if (di.isEnabled()) {
    console.log('[smoke] calling Document Intelligence prebuilt-receipt…');
    const receipt = await di.analyzeReceipt(prepared);
    console.log('[smoke] DI:', JSON.stringify(receipt, null, 2));
  } else {
    console.log('[smoke] Document Intelligence disabled by env');
  }
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
