import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';

interface Project {
  id: string;
  label: string;
  color?: string;
  description?: string;
  taskCount?: number;
  agents?: string[];
  statusCounts?: Record<string, number>;
}

export function registerProjectCommands(program: Command): void {
  const project = program.command('project').description('Project management commands');

  // List projects
  project
    .command('list')
    .description('List all projects')
    .option('-a, --agent <agent>', 'Filter to projects with this agent')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        let projects = await api<Project[]>('/api/projects/enriched');

        if (options.agent) {
          projects = projects.filter((p) => p.agents?.includes(options.agent));
        }

        if (options.json) {
          console.log(JSON.stringify(projects, null, 2));
        } else if (projects.length === 0) {
          console.log(chalk.dim('No projects found'));
        } else {
          console.log(chalk.bold('\n📁 Projects\n'));
          console.log(chalk.dim('─'.repeat(50)));
          projects.forEach((p: Project) => {
            let line = `  ${chalk.cyan(p.label)}`;
            if (p.color) {
              line += chalk.dim(` [${p.color}]`);
            }
            if (p.taskCount !== undefined) {
              let countStr = `${p.taskCount} tasks`;
              if (p.statusCounts && Object.keys(p.statusCounts).length > 0) {
                const parts = Object.entries(p.statusCounts).map(([s, n]) => `${n} ${s}`);
                countStr += `: ${parts.join(', ')}`;
              }
              line += chalk.dim(` (${countStr})`);
            }
            console.log(line);
            if (p.description) {
              console.log(chalk.dim(`    ${p.description}`));
            }
            if (p.agents && p.agents.length > 0) {
              const agentList = p.agents.map((a) => chalk.magenta(`@${a}`)).join(' ');
              console.log(`    Agents: ${agentList}`);
            }
          });
          console.log(chalk.dim('─'.repeat(50)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  // Create project
  project
    .command('create <label>')
    .description('Create a new project')
    .option('-c, --color <color>', 'Project color class (e.g., bg-blue-500/20)')
    .option('-d, --description <desc>', 'Project description')
    .option('--json', 'Output as JSON')
    .action(async (label, options) => {
      try {
        const body: Record<string, string> = { label };
        if (options.color) body.color = options.color;
        if (options.description) body.description = options.description;

        const result = await api<Project>('/api/projects', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.green(`✓ Project created: ${label}`));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
