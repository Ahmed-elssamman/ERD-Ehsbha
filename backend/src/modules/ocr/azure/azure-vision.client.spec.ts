import { parseImageAnalysisResult, polygonToBbox } from './azure-vision.client';
import type { ImageAnalysisResultOutput } from '@azure-rest/ai-vision-image-analysis';

describe('AzureVisionClient pure helpers', () => {
  describe('polygonToBbox', () => {
    it('returns a zero box for empty input', () => {
      expect(polygonToBbox(undefined)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
      expect(polygonToBbox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });

    it('converts a 4-point quadrilateral to an axis-aligned box', () => {
      const box = polygonToBbox([
        { x: 10, y: 12 },
        { x: 110, y: 14 }, // slightly skewed
        { x: 108, y: 42 },
        { x: 8, y: 40 },
      ]);
      expect(box).toEqual({ x: 8, y: 12, w: 102, h: 30 });
    });
  });

  describe('parseImageAnalysisResult', () => {
    it('preserves reading order by Y then X', () => {
      const body: ImageAnalysisResultOutput = {
        metadata: { width: 1000, height: 2000 },
        modelVersion: 'latest',
        readResult: {
          blocks: [
            {
              lines: [
                {
                  text: 'second',
                  boundingPolygon: [
                    { x: 0, y: 200 }, { x: 100, y: 200 },
                    { x: 100, y: 240 }, { x: 0, y: 240 },
                  ],
                  words: [
                    {
                      text: 'second',
                      confidence: 0.9,
                      boundingPolygon: [
                        { x: 0, y: 200 }, { x: 100, y: 200 },
                        { x: 100, y: 240 }, { x: 0, y: 240 },
                      ],
                    },
                  ],
                },
                {
                  text: 'first',
                  boundingPolygon: [
                    { x: 0, y: 100 }, { x: 100, y: 100 },
                    { x: 100, y: 140 }, { x: 0, y: 140 },
                  ],
                  words: [
                    {
                      text: 'first',
                      confidence: 0.95,
                      boundingPolygon: [
                        { x: 0, y: 100 }, { x: 100, y: 100 },
                        { x: 100, y: 140 }, { x: 0, y: 140 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const r = parseImageAnalysisResult(body);
      expect(r.text).toBe('first\nsecond');
      expect(r.lines[0].text).toBe('first');
      expect(r.lines[1].text).toBe('second');
      expect(r.meanConfidence).toBeCloseTo((0.95 + 0.9) / 2, 5);
      expect(r.imageWidth).toBe(1000);
      expect(r.imageHeight).toBe(2000);
    });

    it('handles a payload with no read result gracefully', () => {
      const body: ImageAnalysisResultOutput = {
        metadata: { width: 0, height: 0 },
        modelVersion: 'latest',
      };
      const r = parseImageAnalysisResult(body);
      expect(r.text).toBe('');
      expect(r.lines).toEqual([]);
      expect(r.meanConfidence).toBe(0);
    });
  });
});
