import type {
  Attachment,
  Comment,
  Deliverable,
  Observation,
  ReviewState,
  Subtask,
  Task,
  TaskAttempt,
  VerificationStep,
} from '@veritas-kanban/shared';

// Re-export shared types
export type {
  Attachment,
  Comment,
  Deliverable,
  Observation,
  ReviewState,
  Subtask,
  Task,
  TaskAttempt,
  VerificationStep,
} from '@veritas-kanban/shared';

export interface ActivityEntry {
  id?: string;
  type: string;
  taskId: string;
  taskTitle: string;
  timestamp: string;
  agent?: string;
  details?: Record<string, unknown>;
}

export interface ResolvedTaskDependencies {
  depends_on: Task[];
  blocks: Task[];
}

export interface DependencyGraphNode {
  task: Task;
  children: DependencyGraphNode[];
}

export interface TaskDependencyGraph {
  task: Task;
  upstream: DependencyGraphNode[];
  downstream: DependencyGraphNode[];
}

export interface TaskInspection {
  task: Task;
  dependencies: ResolvedTaskDependencies;
  activity: ActivityEntry[];
}

// Metrics types
export interface TokenMetrics {
  period: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  runs: number;
  perSuccessfulRun: {
    avg: number;
    p50: number;
    p95: number;
  };
  byAgent: Array<{
    agent: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheTokens: number;
    runs: number;
  }>;
}

export interface DurationMetrics {
  period: string;
  runs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  byAgent: Array<{
    agent: string;
    runs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
  }>;
}

export interface TaskCostEntry {
  taskId: string;
  taskTitle?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  runs: number;
  avgCostPerRun: number;
}

export interface TaskCostMetrics {
  period: string;
  tasks: TaskCostEntry[];
  totalCost: number;
  avgCostPerTask: number;
}
