import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';

interface Task {
  id: string;
  status: string;
  project?: string;
  agent?: string;
}

export function registerWorkloadCommands(program: Command): void {
  program
    .command('workload')
    .description('Show per-agent task workload summary')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --project <project>', 'Filter by project')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        let tasks = await api<Task[]>('/api/tasks');

        if (options.status) {
          tasks = tasks.filter((t) => t.status === options.status);
        }
        if (options.project) {
          tasks = tasks.filter((t) => t.project === options.project);
        }

        const agentMap = new Map<string, { total: number; byStatus: Record<string, number> }>();

        for (const t of tasks) {
          const agent = t.agent && t.agent !== 'auto' ? t.agent : '(unassigned)';
          if (!agentMap.has(agent)) {
            agentMap.set(agent, { total: 0, byStatus: {} });
          }
          const entry = agentMap.get(agent)!;
          entry.total++;
          entry.byStatus[t.status] = (entry.byStatus[t.status] || 0) + 1;
        }

        if (options.json) {
          console.log(JSON.stringify(Object.fromEntries(agentMap), null, 2));
        } else {
          console.log(chalk.bold('\n🤖 Agent Workload\n'));
          console.log(chalk.dim('─'.repeat(50)));

          const sorted = [...agentMap.entries()].sort((a, b) => b[1].total - a[1].total);
          for (const [agent, data] of sorted) {
            const name = agent === '(unassigned)' ? chalk.dim(agent) : chalk.magenta(`@${agent}`);
            console.log(`  ${name}  ${chalk.bold(String(data.total))} tasks`);
            const statusParts = Object.entries(data.byStatus)
              .map(([s, n]) => `${s}: ${n}`)
              .join(', ');
            console.log(chalk.dim(`    ${statusParts}`));
          }

          console.log(chalk.dim('─'.repeat(50)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
