import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ocrConfirmationTripSchema, type OcrConfirmationItem, type OcrConfirmationFailure } from '@ehsbha/api-contracts';
import { ArrowLeft, ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { OcrUploadDialog } from '@/components/ocr/ocr-upload-dialog';
import { validateOcrTrip, type OcrSelectedTrip, type OcrSaveOutcome } from '@/lib/ocr/ocr-to-trip';
import { OcrImportsApi } from '@/lib/api/ocr-imports.api';
import { TripForm } from './trip-form';

export function TripNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ocrOpen, setOcrOpen] = useState(false);

  const saveOcrTrips = async (batchId: string, selected: OcrSelectedTrip[]): Promise<OcrSaveOutcome> => {
    const items: OcrConfirmationItem[] = selected.map((selection) => {
      const validated = validateOcrTrip(selection);
      if (!validated.input || !selection.candidate.evidence) throw new Error('OCR_REVIEW_REQUIRED');
      const { clientMutationId: _mutationId, ...fields } = validated.input;
      return { candidateId: selection.candidate.evidence.id, trip: ocrConfirmationTripSchema.parse(fields) };
    });
    const savedCandidateIds: string[] = [];
    const failures: OcrConfirmationFailure[] = [];
    // The write API caps each transaction batch at twenty. Candidate mutation
    // IDs remain constant when a selection or chunk boundary changes.
    for (let offset = 0; offset < items.length; offset += 20) {
      try {
        const response = await OcrImportsApi.confirm(batchId, { items: items.slice(offset, offset + 20) });
        savedCandidateIds.push(...response.saved.map((receipt) => receipt.candidateId));
        failures.push(...response.failed);
      } catch {
        failures.push(...items.slice(offset).map((item) => ({ candidateId: item.candidateId, code: 'OCR_CONFIRMATION_RETRY' })));
        break;
      }
    }
    if (savedCandidateIds.length) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trips'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['decisions'] }),
        queryClient.invalidateQueries({ queryKey: ['score'] }),
      ]);
    }
    const saved = new Set(savedCandidateIds);
    return { savedCandidateIds, failedCandidateIds: items.filter((item) => !saved.has(item.candidateId)).map((item) => item.candidateId), failures };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('trips.add')} actions={<div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setOcrOpen(true)} className="gap-1.5"><ScanLine className="h-4 w-4" aria-hidden />{t('trips.ocr.extractButton')}</Button>
        <Button variant="ghost" onClick={() => navigate('/trips')} className="gap-1.5"><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{t('common.back')}</Button>
      </div>} />
      <Card><CardContent className="p-5 sm:p-6"><TripForm onClose={() => navigate('/trips')} onDone={(id) => navigate(`/trips/${id}`, { replace: true })} /></CardContent></Card>
      <OcrUploadDialog open={ocrOpen} onOpenChange={setOcrOpen} onParsed={saveOcrTrips} />
    </div>
  );
}
