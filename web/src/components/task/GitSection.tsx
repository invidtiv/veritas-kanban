import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useConfig } from '@/hooks/useConfig';
import { GitBranch, Loader2, AlertCircle } from 'lucide-react';
import type { Task, TaskGit } from '@veritas-kanban/shared';
import { GitSelectionForm } from './git/GitSelectionForm';
import { WorktreeStatus } from './git/WorktreeStatus';
import { useIdentity } from '@/hooks/useIdentity';

interface GitSectionProps {
  task: Task;
  onGitChange: (git: Partial<TaskGit> | undefined) => void;
}

export function GitSection({ task, onGitChange }: GitSectionProps) {
  const { data: config, isLoading: configLoading } = useConfig();
  const { hasPermission } = useIdentity();
  const canEditTaskGit = hasPermission('task:write');

  const handleClearGit = () => {
    onGitChange(undefined);
  };

  // Don't allow editing if worktree exists
  const isLocked = !!task.git?.worktreePath || !canEditTaskGit;
  const selectedRepo = task.git?.repo;

  if (configLoading) {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <GitBranch className="h-4 w-4" />
          <Text size="sm" c="dimmed" fw={500}>
            Git Integration
          </Text>
        </Group>
        <Group gap="xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <Text size="sm" c="dimmed">
            Loading...
          </Text>
        </Group>
      </Stack>
    );
  }

  if (!config?.repos.length) {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <GitBranch className="h-4 w-4" />
          <Text size="sm" c="dimmed" fw={500}>
            Git Integration
          </Text>
        </Group>
        <Paper className="border-dashed p-3" radius="md" withBorder>
          <Group gap="xs">
            <AlertCircle className="h-4 w-4" />
            <Text size="sm" c="dimmed">
              No repositories configured. Add one in Settings.
            </Text>
          </Group>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <GitBranch className="h-4 w-4" />
          <Text size="sm" c="dimmed" fw={500}>
            Git Integration
          </Text>
        </Group>
        {selectedRepo && !isLocked && (
          <Button variant="subtle" size="xs" onClick={handleClearGit} disabled={!canEditTaskGit}>
            Clear
          </Button>
        )}
      </Group>

      {!canEditTaskGit && (
        <Paper className="border-dashed p-3" radius="md" withBorder>
          <Text size="sm" c="dimmed">
            Task write permission is required to change Git settings.
          </Text>
        </Paper>
      )}
      <GitSelectionForm task={task} onGitChange={onGitChange} disabled={!canEditTaskGit} />
      <WorktreeStatus task={task} />
    </Stack>
  );
}
