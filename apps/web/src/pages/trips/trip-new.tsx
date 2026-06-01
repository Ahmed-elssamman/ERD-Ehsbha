import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { OcrUploadDialog } from '@/components/ocr/ocr-upload-dialog';
import { parsedToFormValues, deriveClientMutationId } from '@/lib/ocr/parsed-to-form';
import {
  buildCreateTripFromOcr,
  findDriverAppForPlatform,
} from '@/lib/ocr/ocr-to-trip';
import type { OcrExtractResponseDto } from '@/lib/api/ocr.api';
import {
  AppsApi,
  TripsApi,
  VehiclesApi,
  type CreateTripInput,
} from '@/lib/api/endpoints';
import { TripForm, type OcrPrefill } from './trip-form';

export function TripNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPrefill, setOcrPrefill] = useState<OcrPrefill | null>(null);

  // Prefetched lookups used when the driver extracts a multi-trip summary —
  // we need a vehicle and an app to build each CreateTripInput. These queries
  // are already loaded by TripForm below; useQuery here just shares the cache.
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const appsQ = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine });

  // Single trip handler — same as before. We split it out so the multi-trip
  // path doesn't accidentally inherit the prefill side effect.
  const handleParsedSingle = (r: OcrExtractResponseDto) => {
    setOcrPrefill({
      values: parsedToFormValues(r.parsed),
      confidences: r.fieldConfidences,
      imageHashes: r.imageHashes,
      platform: r.platform,
      warnings: r.warnings,
    });
  };

  const bulkCreateMut = useMutation({
    /**
     * Multi-trip save: ONE POST /trips/batch with every card in the body.
     * The server processes them sequentially in its own transactions —
     * earlier we fanned out N parallel POSTs but they raced on the same
     * aggregate counter row and intermittently returned DB_ERROR.
     */
    mutationFn: async (r: OcrExtractResponseDto) => {
      const vehicles = vehiclesQ.data ?? [];
      const apps = appsQ.data ?? [];
      if (vehicles.length === 0 || apps.length === 0) {
        throw new Error('NEED_VEHICLE_OR_APP');
      }
      const vehicleId = vehicles[0].id;
      const matchedApp = findDriverAppForPlatform(apps, r.platform);
      const driverAppId = matchedApp?.id ?? apps[0].id;

      const baseCmid = await deriveClientMutationId(r.imageHashes);
      const items: CreateTripInput[] = r.trips.map((trip, i) => ({
        ...buildCreateTripFromOcr({
          parsed: trip.parsed,
          vehicleId,
          driverAppId,
          imageHashes: r.imageHashes,
          index: i,
        }),
        // Per-card mutation id derived from the shared image hash + index
        // — keeps each create idempotent without making them collide.
        clientMutationId: `${baseCmid}-${i}`,
      }));
      return TripsApi.createBatch(items);
    },
    onSuccess: ({ created }) => {
      if (created.length > 0) {
        qc.invalidateQueries({ queryKey: ['trips'] });
        qc.invalidateQueries({ queryKey: ['analytics'] });
        qc.invalidateQueries({ queryKey: ['decisions'] });
        qc.invalidateQueries({ queryKey: ['score'] });
      }
    },
  });

  const handleParsed = async (
    r: OcrExtractResponseDto,
  ): Promise<void | { keepOpen: true; statusMessage?: { kind: 'error' | 'success'; text: string } }> => {
    if (r.mode !== 'multi' || r.trips.length <= 1) {
      handleParsedSingle(r);
      return;
    }

    // Multi-trip: batch-create every card in r.trips, then navigate.
    try {
      const { created, errors } = await bulkCreateMut.mutateAsync(r);
      if (created.length === r.trips.length) {
        // All saved — leave the new-trip page and show the trips list with
        // the freshly created entries at the top.
        navigate('/trips', { replace: true });
        return;
      }
      if (created.length > 0) {
        // Partial — stay in the dialog and tell the user what failed.
        return {
          keepOpen: true,
          statusMessage: {
            kind: 'error',
            text: t('trips.ocr.savedPartial', {
              ok: created.length,
              total: r.trips.length,
              fail: errors.length,
            }),
          },
        };
      }
      return {
        keepOpen: true,
        statusMessage: { kind: 'error', text: t('trips.ocr.noTripsSaved') },
      };
    } catch (err) {
      const msg =
        (err as Error)?.message === 'NEED_VEHICLE_OR_APP'
          ? t('trips.ocr.needVehicleOrApp')
          : t('trips.ocr.error.UNKNOWN');
      return {
        keepOpen: true,
        statusMessage: { kind: 'error', text: msg },
      };
    }
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
