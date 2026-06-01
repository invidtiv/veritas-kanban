import { Badge, Group, Paper, Progress, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useTokenMetrics, formatTokens, type MetricsPeriod } from '@/hooks/useMetrics';
import { Coins, Bot, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokensDrillDownProps {
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

export function TokensDrillDown({ period, project, from, to }: TokensDrillDownProps) {
  const { data: metrics, isLoading } = useTokenMetrics(period, project, from, to);

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
        <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <Text c="dimmed">No token data available</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Summary Card */}
      <Paper withBorder p="md" radius="md">
        <Text size="sm" fw={500} c="dimmed" mb="sm">
          Token Usage Summary ({getPeriodLabel(period)})
        </Text>
        <SimpleGrid cols={{ base: 2, sm: metrics.cacheTokens > 0 ? 4 : 3 }} spacing="md">
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatTokens(metrics.totalTokens)}
            </div>
            <div className="text-xs text-muted-foreground">Total Tokens</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-500">
              {formatTokens(metrics.inputTokens)}
            </div>
            <div className="text-xs text-muted-foreground">Input</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">
              {formatTokens(metrics.outputTokens)}
            </div>
            <div className="text-xs text-muted-foreground">Output</div>
          </div>
          {metrics.cacheTokens > 0 && (
            <div>
              <div className="text-2xl font-bold text-amber-500">
                {formatTokens(metrics.cacheTokens)}
              </div>
              <div className="text-xs text-muted-foreground">Cache Hits</div>
            </div>
          )}
        </SimpleGrid>

        <div className="mt-4 border-t pt-3">
          <Text size="sm" c="dimmed">
            Per Run Statistics:
          </Text>
          <Group gap="md" mt={4}>
            <div>
              <span className="text-muted-foreground text-xs">Avg: </span>
              <span className="font-medium">{formatTokens(metrics.perSuccessfulRun.avg)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">p50: </span>
              <span className="font-medium">{formatTokens(metrics.perSuccessfulRun.p50)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">p95: </span>
              <span className="font-medium">{formatTokens(metrics.perSuccessfulRun.p95)}</span>
            </div>
          </Group>
        </div>
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
              const percentage =
                metrics.totalTokens > 0 ? (agent.totalTokens / metrics.totalTokens) * 100 : 0;

              return (
                <AgentTokenRow
                  key={agent.agent}
                  agent={agent}
                  percentage={percentage}
                  isTop={index === 0}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

interface AgentTokenRowProps {
  agent: {
    agent: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheTokens?: number;
    runs: number;
  };
  percentage: number;
  isTop: boolean;
}

function AgentTokenRow({ agent, percentage, isTop }: AgentTokenRowProps) {
  return (
    <Paper withBorder p="sm" radius="md" className={cn(isTop && 'border-primary/30 bg-primary/5')}>
      <Group align="center" justify="space-between" gap="sm" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="wrap">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{agent.agent}</span>
          {isTop && (
            <Badge
              variant="light"
              color="blue"
              size="xs"
              leftSection={<TrendingUp className="h-3 w-3" />}
            >
              Top Consumer
            </Badge>
          )}
        </Group>
        <Badge variant="outline" color="gray" size="xs">
          {agent.runs} runs
        </Badge>
      </Group>

      <Progress value={percentage} size="sm" mb="xs" />

      <Group justify="space-between" align="flex-start" gap="sm" className="text-sm">
        <Group gap="md" wrap="wrap">
          <span>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-medium">{formatTokens(agent.totalTokens)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">In: </span>
            <span className="text-blue-500">{formatTokens(agent.inputTokens)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Out: </span>
            <span className="text-green-500">{formatTokens(agent.outputTokens)}</span>
          </span>
          {agent.cacheTokens && agent.cacheTokens > 0 && (
            <span>
              <span className="text-muted-foreground">Cache: </span>
              <span className="text-amber-500">{formatTokens(agent.cacheTokens)}</span>
            </span>
          )}
        </Group>
        <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
      </Group>
    </Paper>
  );
}
