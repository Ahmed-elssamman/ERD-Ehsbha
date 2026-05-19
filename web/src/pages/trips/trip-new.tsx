import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { OcrUploadDialog } from '@/components/ocr/ocr-upload-dialog';
import { parsedToFormValues } from '@/lib/ocr/parsed-to-form';
import type { OcrExtractResponseDto } from '@/lib/api/ocr.api';
import { TripForm, type OcrPrefill } from './trip-form';

export function TripNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPrefill, setOcrPrefill] = useState<OcrPrefill | null>(null);

  const handleParsed = (r: OcrExtractResponseDto) => {
    setOcrPrefill({
      values: parsedToFormValues(r.parsed),
      confidences: r.fieldConfidences,
      imageHashes: r.imageHashes,
      platform: r.platform,
      warnings: r.warnings,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('trips.add')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setOcrOpen(true)} className="gap-1.5">
              <ScanLine className="h-4 w-4" aria-hidden />
              {t('trips.ocr.extractButton')}
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t('common.back')}
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <TripForm
            initialFromOcr={ocrPrefill}
            onDone={(id) => navigate(`/trips/${id}`, { replace: true })}
          />
        </CardContent>
      </Card>

      <OcrUploadDialog open={ocrOpen} onOpenChange={setOcrOpen} onParsed={handleParsed} />
    </div>
  );
}
