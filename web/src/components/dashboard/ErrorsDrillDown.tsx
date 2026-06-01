import { Badge, Group, Paper, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { useFailedRuns, formatDuration, type MetricsPeriod } from '@/hooks/useMetrics';
import { AlertTriangle, Clock, Bot, ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorsDrillDownProps {
  period: MetricsPeriod;
  project?: string;
  onTaskClick?: (taskId: string) => void;
  from?: string;
  to?: string;
}

function getPeriodLabel(period: MetricsPeriod): string {
  const labels: Record<MetricsPeriod, string> = {
    today: 'today',
    '24h': 'last 24 hours',
    '3d': 'last 3 days',
    wtd: 'this week',
    mtd: 'this month',
    ytd: 'this year',
    '7d': 'last 7 days',
    '30d': 'last 30 days',
    '3m': 'last 3 months',
    '6m': 'last 6 months',
    '12m': 'last 12 months',
    all: 'all time',
    custom: 'custom period',
  };
  return labels[period];
}

export function ErrorsDrillDown({ period, project, onTaskClick, from, to }: ErrorsDrillDownProps) {
  const { data: failedRuns, isLoading } = useFailedRuns(period, project, 50, from, to);

  if (isLoading) {
    return (
      <Stack gap="md">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} h={80} radius="md" />
        ))}
      </Stack>
    );
  }

  if (!failedRuns || failedRuns.length === 0) {
    return (
      <Stack align="center" gap="xs" py="xl">
        <ThemeIcon color="green" variant="light" size={48} radius="xl">
          <CheckCircle className="h-6 w-6" />
        </ThemeIcon>
        <Text fw={600}>All runs successful</Text>
        <Text size="sm" c="dimmed">
          No failures in the selected period
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Summary */}
      <Group gap="xs" className="text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span>
          {failedRuns.length} failed run(s) in the {getPeriodLabel(period)}
        </span>
      </Group>

      {/* Failed Runs List */}
      <Stack gap="xs">
        {failedRuns.map((run, index) => (
          <FailedRunRow key={`${run.timestamp}-${index}`} run={run} onTaskClick={onTaskClick} />
        ))}
      </Stack>
    </Stack>
  );
}

interface FailedRunRowProps {
  run: {
    timestamp: string;
    taskId?: string;
    project?: string;
    agent: string;
    errorMessage?: string;
    durationMs?: number;
  };
  onTaskClick?: (taskId: string) => void;
}

function FailedRunRow({ run, onTaskClick }: FailedRunRowProps) {
  const date = new Date(run.timestamp);
  const taskId = run.taskId;
  const canNavigate = Boolean(taskId && onTaskClick);

  const content = (
    <Paper
      withBorder
      p="sm"
      radius="md"
      className={cn(
        'border-red-500/20 bg-red-500/5',
        canNavigate && 'hover:bg-red-500/10 transition-colors cursor-pointer'
      )}
    >
      <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap">
        <div className="flex-1 min-w-0">
          <Group gap="xs" wrap="nowrap">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="font-medium truncate">{run.taskId || 'Unknown task'}</span>
            {canNavigate && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
          </Group>

          {run.errorMessage && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{run.errorMessage}</p>
          )}

          <Group gap="sm" mt="xs" className="text-xs text-muted-foreground" wrap="wrap">
            <Group gap={4}>
              <Bot className="h-3 w-3" />
              {run.agent}
            </Group>
            {run.project && (
              <Badge variant="outline" color="gray" size="xs">
                {run.project}
              </Badge>
            )}
            {run.durationMs && (
              <Group gap={4}>
                <Clock className="h-3 w-3" />
                {formatDuration(run.durationMs)}
              </Group>
            )}
          </Group>
        </div>

        <div className="text-xs text-muted-foreground text-right flex-shrink-0">
          <div>{date.toLocaleDateString()}</div>
          <div>{date.toLocaleTimeString()}</div>
        </div>
      </Group>
    </Paper>
  );

  if (taskId && onTaskClick) {
    return (
      <button
        type="button"
        onClick={() => onTaskClick(taskId)}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
      >
        {content}
      </button>
    );
  }

  return content;
}
