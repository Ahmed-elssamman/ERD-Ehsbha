import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { TripForm } from './trip-form';

export function TripNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('trips.add')}
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            {t('common.back')}
          </Button>
        }
      />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <TripForm onDone={(id) => navigate(`/trips/${id}`, { replace: true })} />
        </CardContent>
      </Card>
    </div>
  );
}
