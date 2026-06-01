import { useI18n } from '@/i18n';
import type { OcrExtractMode, OcrPlatform } from '@/lib/api/ocr.api';

interface Props {
  platform: OcrPlatform | null;
  mode: OcrExtractMode;
  onPlatformChange: (p: OcrPlatform) => void;
  onModeChange: (m: OcrExtractMode) => void;
  disabled?: boolean;
}

/**
 * Pre-upload selectors: the driver tells us which app they screenshotted and
 * whether it's a single-trip detail screen or a multi-trip earnings summary.
 * Both choices are required before the dropzone enables.
 *
 * Layout:
 *   - Platform: 4 brand chips in a 2-column grid on mobile, 4-column on sm+.
 *   - Mode: two large pill buttons stacked on mobile, side-by-side on sm+.
 *
 * Each control hosts a short hint so first-time users understand the
 * difference between the two modes without leaving the dialog.
 */
export function OcrSourceSelector({
  platform,
  mode,
  onPlatformChange,
  onModeChange,
  disabled,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="block text-sm font-medium">{t('trips.ocr.selectPlatform')}</legend>
        <p className="text-xs text-muted-foreground">{t('trips.ocr.selectPlatformHint')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(PLATFORMS as ReadonlyArray<PlatformDef>).map((p) => {
            const selected = platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPlatformChange(p.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={[
                  'group relative flex h-16 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-input bg-background hover:border-primary/50 hover:bg-accent',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: p.accent }}
                />
                <span className="whitespace-nowrap">{p.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="block text-sm font-medium">{t('trips.ocr.selectMode')}</legend>
        <p className="text-xs text-muted-foreground">{t('trips.ocr.selectModeHint')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(MODES as ReadonlyArray<ModeDef>).map((m) => {
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={[
                  'flex items-start gap-3 rounded-xl border p-3 text-start transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background hover:border-primary/50 hover:bg-accent',
                ].join(' ')}
              >
                <span aria-hidden className="mt-0.5 text-lg leading-none">
                  {m.icon}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{t(m.labelKey)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(m.hintKey)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

interface PlatformDef {
  id: OcrPlatform;
  label: string;
  /** Brand-ish accent color used as a small status dot. */
  accent: string;
}
const PLATFORMS: PlatformDef[] = [
  { id: 'UBER', label: 'Uber', accent: '#000000' },
  { id: 'INDRIVE', label: 'inDrive', accent: '#C0F11D' },
  { id: 'DIDI', label: 'DiDi', accent: '#FF7D00' },
  { id: 'CAREEM', label: 'Careem', accent: '#0BAB1A' },
];

interface ModeDef {
  id: OcrExtractMode;
  labelKey: string;
  hintKey: string;
  icon: string;
}
const MODES: ModeDef[] = [
  { id: 'single', labelKey: 'trips.ocr.modeSingle', hintKey: 'trips.ocr.modeSingleHint', icon: '📄' },
  { id: 'multi', labelKey: 'trips.ocr.modeMulti', hintKey: 'trips.ocr.modeMultiHint', icon: '📑' },
];
