import type { GovernanceTraceListFilters, GovernanceTraceRecord } from '@veritas-kanban/shared';
import { API_BASE, handleResponse } from './helpers';

function toQuery(filters: GovernanceTraceListFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.kind) params.set('kind', filters.kind);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.taskId) params.set('taskId', filters.taskId);
  if (filters.actionType) params.set('actionType', filters.actionType);
  if (filters.startTime) params.set('startTime', filters.startTime);
  if (filters.endTime) params.set('endTime', filters.endTime);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));

  const query = params.toString();
  return query ? `?${query}` : '';
}

export const governanceTracesApi = {
  list: async (filters: GovernanceTraceListFilters = {}): Promise<GovernanceTraceRecord[]> => {
    const response = await fetch(`${API_BASE}/governance/traces${toQuery(filters)}`, {
      credentials: 'include',
    });
    return handleResponse<GovernanceTraceRecord[]>(response);
  },

  get: async (id: string): Promise<GovernanceTraceRecord> => {
    const response = await fetch(`${API_BASE}/governance/traces/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    return handleResponse<GovernanceTraceRecord>(response);
  },
};
