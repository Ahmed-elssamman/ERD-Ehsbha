import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VehiclesApi, type Vehicle } from '@/lib/api/endpoints';

/** Returns vehicles + a stable selected id (defaults to first active). */
export function useVehicleSelector() {
  const q = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!selectedId && q.data && q.data.length > 0) {
      const first = q.data.find((v) => v.isActive) ?? q.data[0];
      setSelectedId(first.id);
    }
  }, [q.data, selectedId]);

  const selected: Vehicle | undefined = q.data?.find((v) => v.id === selectedId);

  return {
    vehicles: q.data ?? [],
    isLoading: q.isLoading,
    selectedId,
    selected,
    setSelectedId,
  };
}

export function vehicleLabel(v: Vehicle): string {
  return [v.make, v.model, v.year].filter(Boolean).join(' ') || v.type;
}
