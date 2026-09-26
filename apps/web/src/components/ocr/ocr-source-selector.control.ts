import type { OcrExtractMode, OcrPlatform } from '@/lib/api/ocr.api';

export interface PlatformControl { id: OcrPlatform | null; labelKey: string }
export const OCR_PLATFORMS: PlatformControl[] = [
  { id: null, labelKey: 'trips.ocr.autoDetect' },
  { id: 'UBER', labelKey: 'trips.ocr.platformUber' },
  { id: 'INDRIVE', labelKey: 'trips.ocr.platformIndrive' },
  { id: 'DIDI', labelKey: 'trips.ocr.platformDidi' },
  { id: 'CAREEM', labelKey: 'trips.ocr.platformCareem' },
];
export interface ModeControl { id: OcrExtractMode; labelKey: string; hintKey: string }
export const OCR_MODES: ModeControl[] = [
  { id: 'auto', labelKey: 'trips.ocr.modeAuto', hintKey: 'trips.ocr.modeAutoHint' },
  { id: 'single', labelKey: 'trips.ocr.modeSingle', hintKey: 'trips.ocr.modeSingleHint' },
  { id: 'multi', labelKey: 'trips.ocr.modeMulti', hintKey: 'trips.ocr.modeMultiHint' },
];
