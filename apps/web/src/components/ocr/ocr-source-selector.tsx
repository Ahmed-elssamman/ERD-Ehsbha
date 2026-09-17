import { useI18n } from '@/i18n';
import type { OcrExtractMode, OcrPlatform } from '@/lib/api/ocr.api';
import { OCR_MODES, OCR_PLATFORMS } from './ocr-source-selector.control';

interface Props {
  platform: OcrPlatform | null;
  mode: OcrExtractMode;
  onPlatformChange: (platform: OcrPlatform | null) => void;
  onModeChange: (mode: OcrExtractMode) => void;
  disabled?: boolean;
}

export function OcrSourceSelector({ platform, mode, onPlatformChange, onModeChange, disabled }: Props) {
  const { t } = useI18n();
  return <div className="space-y-4">
    <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm font-medium">{t('trips.ocr.selectPlatform')}</legend><p className="text-xs text-muted-foreground">{t('trips.ocr.selectPlatformHint')}</p>
      <div className="flex flex-wrap gap-2">{OCR_PLATFORMS.map((option) => <button key={option.id ?? 'auto'} type="button" aria-pressed={platform === option.id} onClick={() => onPlatformChange(option.id)} className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary ${platform === option.id ? 'border-primary bg-primary/10' : 'bg-background'}`}>{t(option.labelKey)}</button>)}</div>
    </fieldset>
    <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm font-medium">{t('trips.ocr.selectMode')}</legend>
      <div className="grid gap-2 sm:grid-cols-3">{OCR_MODES.map((option) => <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => onModeChange(option.id)} className={`min-h-11 rounded-lg border p-3 text-start focus-visible:ring-2 focus-visible:ring-primary ${mode === option.id ? 'border-primary bg-primary/10' : 'bg-background'}`}><span className="block text-sm font-medium">{t(option.labelKey)}</span><span className="text-xs text-muted-foreground">{t(option.hintKey)}</span></button>)}</div>
    </fieldset>
  </div>;
}
