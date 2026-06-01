import { Badge, Group, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useDurationMetrics, formatDuration, type MetricsPeriod } from '@/hooks/useMetrics';
import { Clock, Bot, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DurationDrillDownProps {
  period: MetricsPeriod;
  project?: string;
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

export function DurationDrillDown({ period, project, from, to }: DurationDrillDownProps) {
  const { data: metrics, isLoading } = useDurationMetrics(period, project, from, to);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton h={96} radius="md" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} h={64} radius="md" />
        ))}
      </Stack>
    );
  }

  if (!metrics) {
    return (
      <Stack align="center" gap="xs" py="xl">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <Text c="dimmed">No duration data available</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Summary Card */}
      <Paper withBorder p="md" radius="md">
        <Text size="sm" fw={500} c="dimmed" mb="sm">
          Run Duration Summary ({getPeriodLabel(period)})
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <div>
            <div className="text-2xl font-bold text-primary">{metrics.runs}</div>
            <div className="text-xs text-muted-foreground">Total Runs</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{formatDuration(metrics.avgMs)}</div>
            <div className="text-xs text-muted-foreground">Average</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">{formatDuration(metrics.p50Ms)}</div>
            <div className="text-xs text-muted-foreground">Median (p50)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-500">
              {formatDuration(metrics.p95Ms)}
            </div>
            <div className="text-xs text-muted-foreground">95th Percentile</div>
          </div>
        </SimpleGrid>
      </Paper>

      {/* Per-Agent Breakdown */}
      <Stack gap="sm">
        <Group gap="xs">
          <Bot className="h-4 w-4" />
          <Text size="sm" fw={500} c="dimmed">
            Breakdown by Agent
          </Text>
        </Group>

        {metrics.byAgent.length === 0 ? (
          <Text ta="center" c="dimmed" py="md">
            No agent data available
          </Text>
        ) : (
          <Stack gap="xs">
            {metrics.byAgent.map((agent, index) => {
              // Find fastest and slowest
              const isFastest =
                index === metrics.byAgent.length - 1 ||
                agent.avgMs === Math.min(...metrics.byAgent.map((a) => a.avgMs));
              const isSlowest =
                index === 0 &&
                metrics.byAgent.length > 1 &&
                agent.avgMs === Math.max(...metrics.byAgent.map((a) => a.avgMs));

              return (
                <AgentDurationRow
                  key={agent.agent}
                  agent={agent}
                  overallAvg={metrics.avgMs}
                  isFastest={isFastest}
                  isSlowest={isSlowest}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

interface AgentDurationRowProps {
  agent: {
    agent: string;
    runs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
  };
  overallAvg: number;
  isFastest: boolean;
  isSlowest: boolean;
}

function AgentDurationRow({ agent, overallAvg, isFastest, isSlowest }: AgentDurationRowProps) {
  const diff = agent.avgMs - overallAvg;
  const diffPercent = overallAvg > 0 ? (diff / overallAvg) * 100 : 0;
  const isAboveAvg = diff > 0;

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      className={cn(
        isFastest && 'border-green-500/30 bg-green-500/5',
        isSlowest && 'border-yellow-500/30 bg-yellow-500/5'
      )}
    >
      <Group align="center" justify="space-between" gap="sm" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="wrap">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{agent.agent}</span>
          {isFastest && (
            <Badge
              variant="light"
              color="green"
              size="xs"
              leftSection={<TrendingDown className="h-3 w-3" />}
            >
              Fastest
            </Badge>
          )}
          {isSlowest && (
            <Badge
              variant="light"
              color="yellow"
              size="xs"
              leftSection={<TrendingUp className="h-3 w-3" />}
            >
              Slowest
            </Badge>
          )}
        </Group>
        <Badge variant="outline" color="gray" size="xs">
          {agent.runs} runs
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" className="text-sm">
        <div>
          <span className="text-muted-foreground text-xs block">Average</span>
          <span className="font-medium">{formatDuration(agent.avgMs)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Median</span>
          <span className="font-medium text-green-500">{formatDuration(agent.p50Ms)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">p95</span>
          <span className="font-medium text-yellow-500">{formatDuration(agent.p95Ms)}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground text-xs block">vs Avg</span>
          <span className={cn('font-medium', isAboveAvg ? 'text-red-500' : 'text-green-500')}>
            {isAboveAvg ? '+' : ''}
            {diffPercent.toFixed(1)}%
          </span>
        </div>
      </SimpleGrid>
    </Paper>
  );
}
