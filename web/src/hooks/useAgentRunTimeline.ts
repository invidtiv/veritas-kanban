import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { apiFetch } from '@/lib/api/helpers';
import type { AnyTelemetryEvent } from '@veritas-kanban/shared';

interface AgentRunTimelineQueryOptions {
  live?: boolean;
}

const LIVE_RUN_REFETCH_MS = 2000;

export function useAgentRunTraces(
  taskId: string | undefined,
  options: AgentRunTimelineQueryOptions = {}
) {
  return useQuery({
    queryKey: ['traces', 'task', taskId],
    queryFn: () => (taskId ? api.traces.listForTask(taskId) : Promise.resolve([])),
    enabled: Boolean(taskId),
    refetchInterval: options.live ? LIVE_RUN_REFETCH_MS : false,
    staleTime: options.live ? 0 : 30000,
  });
}

export function useTaskTelemetryEvents(
  taskId: string | undefined,
  options: AgentRunTimelineQueryOptions = {}
) {
  return useQuery({
    queryKey: ['telemetry', 'task', taskId],
    queryFn: () =>
      taskId
        ? apiFetch<AnyTelemetryEvent[]>(`/api/telemetry/events/task/${encodeURIComponent(taskId)}`)
        : Promise.resolve([]),
    enabled: Boolean(taskId),
    refetchInterval: options.live ? LIVE_RUN_REFETCH_MS : false,
    staleTime: options.live ? 0 : 30000,
  });
}
