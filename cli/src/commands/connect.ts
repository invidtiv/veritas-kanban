import { Command } from 'commander';
import chalk from 'chalk';
import {
  writeConfig,
  readConfig,
  clearConfig,
  resolveServerUrl,
  getConfigDir,
} from '@veritas-kanban/shared';

interface HealthResponse {
  ok: boolean;
  version: string;
  uptimeMs: number;
}

export function registerConnectCommands(program: Command): void {
  program
    .command('connect')
    .description('Connect CLI to a remote Veritas Kanban server (e.g. over Tailscale)')
    .argument('<url>', 'Server URL (e.g. http://myhost.tail652dda.ts.net:3001)')
    .option('-k, --key <key>', 'API key for authentication')
    .option('-n, --name <name>', 'Profile name for this connection')
    .option('--json', 'Output result as JSON')
    .action(async (url: string, options: { key?: string; name?: string; json?: boolean }) => {
      // Normalize URL — strip trailing slash
      const serverUrl = url.replace(/\/+$/, '');

      if (!options.json) {
        console.log(chalk.bold('\nConnecting to Veritas Kanban server...\n'));
        console.log(chalk.dim(`  URL: ${serverUrl}`));
      }

      // Test connectivity before saving
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (options.key) {
          headers['X-API-Key'] = options.key;
        }

        const res = await fetch(`${serverUrl}/api/health`, { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const health = (await res.json()) as { data?: HealthResponse } & HealthResponse;
        // Handle envelope or direct response
        const data = health.data ?? health;

        if (!options.json) {
          console.log(chalk.green(`  ✓ Server reachable (v${data.version})`));
        }

        // If key provided, test authenticated access
        if (options.key) {
          const authRes = await fetch(`${serverUrl}/api/tasks`, {
            headers: { ...headers, 'X-API-Key': options.key },
          });
          if (authRes.ok) {
            if (!options.json) console.log(chalk.green('  ✓ API key valid'));
          } else {
            if (!options.json) console.log(chalk.yellow('  ⚠ API key rejected — saving anyway'));
          }
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: msg }));
        } else {
          console.log(chalk.red(`  ✗ Cannot reach server: ${msg}`));
          console.log(chalk.dim('\n  Check that:'));
          console.log(chalk.dim('    1. The server is running'));
          console.log(chalk.dim('    2. Tailscale is connected (tailscale status)'));
          console.log(chalk.dim('    3. The URL and port are correct'));
        }
        process.exit(1);
      }

      // Save config
      const config = writeConfig({
        serverUrl,
        ...(options.key ? { apiKey: options.key } : {}),
        ...(options.name ? { profileName: options.name } : {}),
      });

      if (options.json) {
        console.log(
          JSON.stringify({
            success: true,
            config: { serverUrl: config.serverUrl, profileName: config.profileName },
          })
        );
      } else {
        console.log(chalk.green('\n✅ Connected!\n'));
        console.log(chalk.dim(`  Config saved to: ${getConfigDir()}`));
        console.log(chalk.dim(`  All vk commands will now use: ${serverUrl}`));
        console.log(chalk.dim(`\n  Test it: ${chalk.cyan('vk list')}`));
        console.log();
      }
    });

  program
    .command('disconnect')
    .description('Remove saved server connection and reset to localhost')
    .option('--json', 'Output result as JSON')
    .action((options: { json?: boolean }) => {
      clearConfig();
      if (options.json) {
        console.log(JSON.stringify({ success: true, serverUrl: 'http://localhost:3001' }));
      } else {
        console.log(chalk.green('\n✅ Disconnected. CLI reset to http://localhost:3001\n'));
      }
    });

  program
    .command('status')
    .description('Show current connection status and config')
    .option('--json', 'Output result as JSON')
    .action(async (options: { json?: boolean }) => {
      const config = readConfig();
      const effectiveUrl = resolveServerUrl();

      const info = {
        serverUrl: effectiveUrl,
        source: process.env.VK_API_URL ? 'env:VK_API_URL' : config.serverUrl ? 'config' : 'default',
        profileName: config.profileName || null,
        configDir: getConfigDir(),
        hasApiKey: !!(process.env.VERITAS_ADMIN_KEY || process.env.VK_API_KEY || config.apiKey),
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log(chalk.bold('\nVeritas Kanban Connection Status\n'));
      console.log(`  Server:  ${chalk.cyan(info.serverUrl)}`);
      console.log(`  Source:  ${chalk.dim(info.source)}`);
      if (info.profileName) console.log(`  Profile: ${info.profileName}`);
      console.log(
        `  API Key: ${info.hasApiKey ? chalk.green('configured') : chalk.yellow('not set')}`
      );
      console.log(`  Config:  ${chalk.dim(info.configDir)}`);

      // Test connectivity
      try {
        const res = await fetch(`${effectiveUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          console.log(`  Health:  ${chalk.green('reachable')}`);
        } else {
          console.log(`  Health:  ${chalk.red(`HTTP ${res.status}`)}`);
        }
      } catch {
        console.log(`  Health:  ${chalk.red('unreachable')}`);
      }
      console.log();
    });
}
