import chalk from 'chalk';
import type {
  ActivityEntry,
  DependencyGraphNode,
  ResolvedTaskDependencies,
  Task,
  TaskDependencyGraph,
} from './types.js';

function formatTimestamp(value?: string): string {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatRelativeLine(label: string, value?: string): string {
  return chalk.dim(`${label}: ${formatTimestamp(value)}`);
}

function formatCheckbox(checked: boolean): string {
  return checked ? chalk.green('[x]') : chalk.dim('[ ]');
}

function formatAssignment(task: Task): string[] {
  const tokens: string[] = [];

  if (task.agent) {
    tokens.push(chalk.magenta(`@${task.agent}`));
  }

  if (task.createdBy) {
    tokens.push(chalk.blue(`←${task.createdBy}`));
  }

  return tokens;
}

function formatDependencyTask(task: Task): string {
  return `${chalk.cyan(task.id.slice(-8))} ${chalk.bold(task.title)}`;
}

function formatSubtaskLines(task: Task): string[] {
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) {
    return [chalk.dim('No subtasks')];
  }

  const lines: string[] = [];
  for (const subtask of subtasks) {
    lines.push(
      `${formatCheckbox(subtask.completed)} ${subtask.title} ${chalk.dim(`#${subtask.id.slice(-8)}`)}`
    );
    subtask.acceptanceCriteria?.forEach((criterion, index) => {
      const checked = subtask.criteriaChecked?.[index] ?? false;
      lines.push(`  ${formatCheckbox(checked)} ${criterion}`);
    });
  }
  return lines;
}

function formatVerificationLines(task: Task): string[] {
  const steps = task.verificationSteps || [];
  if (steps.length === 0) {
    return [chalk.dim('No verification steps')];
  }

  return steps.map(
    (step) =>
      `${formatCheckbox(step.checked)} ${step.description}${step.checkedAt ? chalk.dim(` (${formatTimestamp(step.checkedAt)})`) : ''}`
  );
}

function formatDependencyLines(task: Task, dependencies?: ResolvedTaskDependencies): string[] {
  if (dependencies) {
    const dependsOn = dependencies.depends_on.length
      ? dependencies.depends_on.map((item) => `  depends on ${formatDependencyTask(item)}`)
      : ['  depends on none'];
    const blocks = dependencies.blocks.length
      ? dependencies.blocks.map((item) => `  blocks ${formatDependencyTask(item)}`)
      : ['  blocks none'];
    return [...dependsOn, ...blocks].map((line) => chalk.dim(line));
  }

  const rawDependsOn = task.dependencies?.depends_on || [];
  const rawBlocks = task.dependencies?.blocks || [];
  if (rawDependsOn.length === 0 && rawBlocks.length === 0) {
    return [chalk.dim('No dependencies')];
  }

  return [
    ...rawDependsOn.map((id) => chalk.dim(`  depends on ${id}`)),
    ...rawBlocks.map((id) => chalk.dim(`  blocks ${id}`)),
  ];
}

function formatCommentLines(task: Task): string[] {
  const comments = task.comments || [];
  if (comments.length === 0) {
    return [chalk.dim('No comments')];
  }

  return comments.slice(-10).map((comment) => {
    const prefix = `${chalk.bold(comment.author)} ${chalk.dim(formatTimestamp(comment.timestamp))}`;
    const body = comment.text
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `${prefix}\n${body}`;
  });
}

function formatObservationLines(task: Task): string[] {
  const observations = task.observations || [];
  if (observations.length === 0) {
    return [chalk.dim('No observations')];
  }

  return observations
    .slice(-10)
    .map(
      (observation) =>
        `${chalk.bold(observation.type)} ${chalk.dim(formatTimestamp(observation.timestamp))} ${observation.agent ? chalk.dim(`@${observation.agent}`) : ''}\n  ${observation.content}`
    );
}

function formatAttachmentLines(task: Task): string[] {
  const attachments = task.attachments || [];
  if (attachments.length === 0) {
    return [chalk.dim('No attachments')];
  }

  return attachments.map(
    (attachment) =>
      `${attachment.originalName} ${chalk.dim(`(${attachment.mimeType}, ${attachment.size} bytes, ${formatTimestamp(attachment.uploaded)})`)}`
  );
}

function formatDeliverableLines(task: Task): string[] {
  const deliverables = task.deliverables || [];
  if (deliverables.length === 0) {
    return [chalk.dim('No deliverables')];
  }

  return deliverables.map((deliverable) => {
    const suffix = [
      deliverable.type,
      deliverable.status,
      deliverable.agent ? `by ${deliverable.agent}` : undefined,
      deliverable.path,
    ]
      .filter(Boolean)
      .join(' · ');
    return `${deliverable.title}${suffix ? chalk.dim(` (${suffix})`) : ''}`;
  });
}

function formatActivityLines(activity: ActivityEntry[], limit: number): string[] {
  if (activity.length === 0) {
    return [chalk.dim('No activity')];
  }

  return activity.slice(0, limit).map((entry) => {
    const detail =
      entry.details && Object.keys(entry.details).length > 0
        ? ` ${chalk.dim(JSON.stringify(entry.details))}`
        : '';
    const actor = entry.agent ? chalk.dim(` @${entry.agent}`) : '';
    return `${entry.type}${actor} ${chalk.dim(formatTimestamp(entry.timestamp))}${detail}`;
  });
}

function section(title: string, lines: string[]): string {
  return `${chalk.bold(title)}\n${lines.join('\n')}`;
}

export function formatTask(task: Task, verbose = false): string {
  const statusColors: Record<string, (s: string) => string> = {
    todo: chalk.gray,
    'in-progress': chalk.yellow,
    blocked: chalk.red,
    done: chalk.green,
    cancelled: chalk.dim,
  };

  const priorityColors: Record<string, (s: string) => string> = {
    low: chalk.dim,
    medium: chalk.white,
    high: chalk.red,
    critical: chalk.bgRed.white,
  };

  const typeIcons: Record<string, string> = {
    code: '💻',
    research: '🔍',
    content: '📝',
    automation: '⚡',
  };

  const statusColor = statusColors[task.status] || chalk.white;
  const priorityColor = priorityColors[task.priority] || chalk.white;

  let line = `${typeIcons[task.type] || '•'} ${chalk.cyan(task.id.slice(-8))} `;
  line += statusColor(`[${task.status}]`) + ' ';
  line += priorityColor(`(${task.priority})`) + ' ';
  line += chalk.bold(task.title);

  if (task.project) {
    line += chalk.dim(` #${task.project}`);
  }
  if (task.sprint) {
    line += chalk.dim(` %${task.sprint}`);
  }

  const assignmentTokens = formatAssignment(task);
  if (assignmentTokens.length) {
    line += ` ${assignmentTokens.join(chalk.dim(' · '))}`;
  }

  if (verbose) {
    line += '\n';
    if (task.description) {
      line += chalk.dim(
        `   ${task.description.slice(0, 80)}${task.description.length > 80 ? '...' : ''}\n`
      );
    }
    if (task.git?.branch) {
      line += chalk.dim(`   🌿 ${task.git.branch}\n`);
    }
    if (task.attempt?.status === 'running') {
      line += chalk.yellow(`   🤖 Agent running (${task.attempt.agent})\n`);
    }
    if (task.review?.decision) {
      const decisionColors: Record<string, (s: string) => string> = {
        approved: chalk.green,
        'changes-requested': chalk.yellow,
        rejected: chalk.red,
      };
      const color = decisionColors[task.review.decision] || chalk.white;
      line += color(`   ✓ ${task.review.decision}\n`);
    }
    if (task.sprint) {
      line += chalk.dim(`   Sprint: ${task.sprint}\n`);
    }
    if (task.createdBy) {
      line += chalk.dim(`   Created by: ${task.createdBy}\n`);
    }
  }

  return line;
}

export function formatTaskDetails(
  task: Task,
  options: {
    dependencies?: ResolvedTaskDependencies;
    activity?: ActivityEntry[];
    activityLimit?: number;
    includeActivity?: boolean;
  } = {}
): string {
  const metadata = [
    `ID: ${chalk.cyan(task.id)}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Type: ${task.type}`,
    `Project: ${task.project || 'none'}`,
    `Sprint: ${task.sprint || 'none'}`,
    `Created By: ${task.createdBy || 'unknown'}`,
    `Assigned To: ${task.agent || 'unassigned'}`,
    `Collaborators: ${task.agents?.join(', ') || 'none'}`,
    formatRelativeLine('Created', task.created),
    formatRelativeLine('Updated', task.updated),
  ];

  if (task.timeTracking) {
    metadata.push(
      `Tracked Time: ${task.timeTracking.totalSeconds}s${task.timeTracking.isRunning ? ' (running)' : ''}`
    );
  }

  const sections = [
    formatTask(task, true),
    chalk.dim('─'.repeat(72)),
    section('Metadata', metadata),
    section('Description', [task.description || chalk.dim('No description')]),
    section('Subtasks', formatSubtaskLines(task)),
    section('Verification', formatVerificationLines(task)),
    section('Dependencies', formatDependencyLines(task, options.dependencies)),
    section('Comments', formatCommentLines(task)),
    section('Observations', formatObservationLines(task)),
    section('Attachments', formatAttachmentLines(task)),
    section('Deliverables', formatDeliverableLines(task)),
  ];

  if (task.attempt) {
    sections.push(
      section('Attempt', [
        `Agent: ${task.attempt.agent}`,
        `Status: ${task.attempt.status}`,
        `Started: ${formatTimestamp(task.attempt.started)}`,
        `Ended: ${formatTimestamp(task.attempt.ended)}`,
      ])
    );
  }

  if (task.review?.decision) {
    sections.push(
      section('Review', [
        `Decision: ${task.review.decision}`,
        `Decided At: ${formatTimestamp(task.review.decidedAt)}`,
        `Summary: ${task.review.summary || 'none'}`,
      ])
    );
  }

  if (options.includeActivity) {
    sections.push(
      section('Activity', formatActivityLines(options.activity || [], options.activityLimit || 20))
    );
  }

  return sections.join('\n\n');
}

function formatDependencyTreeNodes(nodes: DependencyGraphNode[], depth = 0): string[] {
  const prefix = `${'  '.repeat(depth)}- `;
  return nodes.flatMap((node) => [
    `${prefix}${formatDependencyTask(node.task)}`,
    ...formatDependencyTreeNodes(node.children, depth + 1),
  ]);
}

export function formatDependencyGraph(graph: TaskDependencyGraph): string {
  return [
    chalk.bold(`Dependency graph for ${graph.task.title}`),
    chalk.dim(`Task: ${graph.task.id}`),
    '',
    section(
      'Upstream',
      graph.upstream.length
        ? formatDependencyTreeNodes(graph.upstream)
        : [chalk.dim('No upstream dependencies')]
    ),
    '',
    section(
      'Downstream',
      graph.downstream.length
        ? formatDependencyTreeNodes(graph.downstream)
        : [chalk.dim('No downstream dependencies')]
    ),
  ].join('\n');
}

export function formatTaskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

export function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}
