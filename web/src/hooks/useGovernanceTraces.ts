import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GovernanceTraceListFilters } from '@veritas-kanban/shared';

export function useGovernanceTraces(filters: GovernanceTraceListFilters) {
  return useQuery({
    queryKey: ['governance-traces', filters],
    queryFn: () => api.governanceTraces.list(filters),
  });
}

export function useGovernanceTrace(id: string | null) {
  return useQuery({
    queryKey: ['governance-traces', id],
    queryFn: () => {
      if (!id) {
        throw new Error('Governance trace id is required');
      }
      return api.governanceTraces.get(id);
    },
    enabled: !!id,
  });
}
