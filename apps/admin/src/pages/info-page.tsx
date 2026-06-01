import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingSchemaPayload {
  status: 'PENDING_SCHEMA';
  message: string;
  hint?: string;
}

interface InfoPageProps {
  title: string;
  description?: string;
  query: () => Promise<unknown>;
  queryKey: readonly string[];
}

function isPendingSchema(d: unknown): d is PendingSchemaPayload {
  return typeof d === 'object' && d !== null && (d as { status?: string }).status === 'PENDING_SCHEMA';
}

export function InfoPage({ title, description, query, queryKey }: InfoPageProps) {
  const { data, isLoading, error }: UseQueryResult<unknown> = useQuery({ queryKey, queryFn: query });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={description} />
      {isLoading && <Skeleton className="h-40 w-full" />}
      {Boolean(error) && <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Failed to load.</div>}
      {data != null && isPendingSchema(data) && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Info className="h-4 w-4" /> Schema pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{data.message}</p>
            {data.hint && <p className="text-xs text-muted-foreground">{data.hint}</p>}
          </CardContent>
        </Card>
      )}
      {data != null && !isPendingSchema(data) && (
        <Card>
          <CardContent className="pt-4">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 font-mono text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
