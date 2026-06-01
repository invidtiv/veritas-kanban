import { useState } from 'react';
import { Alert, Badge, Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import {
  useWorktreeStatus,
  useCreateWorktree,
  useDeleteWorktree,
  useRebaseWorktree,
  useMergeWorktree,
} from '@/hooks/useWorktree';
import { useGitHubStatus } from '@/hooks/useGitHub';
import { useConflictStatus } from '@/hooks/useConflicts';
import { ConflictResolver } from '../ConflictResolver';
import { PRDialog } from './PRDialog';
import {
  Loader2,
  AlertCircle,
  Play,
  ExternalLink,
  RefreshCw,
  GitMerge,
  Trash2,
  FileCode,
  ArrowUp,
  ArrowDown,
  GitPullRequest,
  AlertTriangle,
} from 'lucide-react';
import type { Task } from '@veritas-kanban/shared';

interface WorktreeStatusProps {
  task: Task;
}

export function WorktreeStatus({ task }: WorktreeStatusProps) {
  const hasWorktree = !!task.git?.worktreePath;
  const hasPR = !!task.git?.prUrl;
  const { data: status, isLoading, error } = useWorktreeStatus(task.id, hasWorktree);
  const { data: ghStatus } = useGitHubStatus();
  const { data: conflictStatus } = useConflictStatus(hasWorktree ? task.id : undefined);

  const createWorktree = useCreateWorktree();
  const deleteWorktree = useDeleteWorktree();
  const rebaseWorktree = useRebaseWorktree();
  const mergeWorktree = useMergeWorktree();

  // Conflict resolver state
  const [conflictResolverOpen, setConflictResolverOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleOpenInVSCode = () => {
    if (task.git?.worktreePath) {
      window.open(`vscode://file/${task.git.worktreePath}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenPR = () => {
    if (task.git?.prUrl) {
      window.open(task.git.prUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!task.git?.repo || !task.git?.branch) {
    return null;
  }

  // No worktree yet - show create button
  if (!hasWorktree) {
    return (
      <Stack gap="xs" className="mt-3 border-t pt-3">
        <Button
          variant="outline"
          fullWidth
          onClick={() => createWorktree.mutate(task.id)}
          disabled={createWorktree.isPending}
          leftSection={
            createWorktree.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )
          }
        >
          Create Worktree
        </Button>
        {createWorktree.error && (
          <Text size="xs" c="red">
            {(createWorktree.error as Error).message}
          </Text>
        )}
      </Stack>
    );
  }

  // Loading worktree status
  if (isLoading) {
    return (
      <Group gap="xs" className="mt-3 border-t pt-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <Text size="sm" c="dimmed">
          Loading worktree status...
        </Text>
      </Group>
    );
  }

  // Error loading status
  if (error) {
    return (
      <Group gap="xs" className="mt-3 border-t pt-3">
        <AlertCircle className="h-4 w-4" />
        <Text size="sm" c="red">
          {(error as Error).message}
        </Text>
      </Group>
    );
  }

  // Show worktree status
  return (
    <Stack gap="sm" className="mt-3 border-t pt-3">
      {/* Conflict warning banner */}
      {conflictStatus?.hasConflicts && (
        <Alert
          color="yellow"
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`${conflictStatus.conflictingFiles.length} conflict${
            conflictStatus.conflictingFiles.length !== 1 ? 's' : ''
          } detected`}
        >
          <Group justify="space-between" align="center" gap="sm">
            <Text size="xs" c="yellow.7">
              {conflictStatus.rebaseInProgress ? 'Rebase' : 'Merge'} requires manual resolution
            </Text>
            <Button
              size="xs"
              variant="outline"
              color="yellow"
              onClick={() => setConflictResolverOpen(true)}
              leftSection={<AlertTriangle className="h-4 w-4" />}
            >
              Resolve Conflicts
            </Button>
          </Group>
        </Alert>
      )}

      {/* Status indicators */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <span
            className={`h-2 w-2 rounded-full ${
              conflictStatus?.hasConflicts ? 'bg-amber-500' : 'bg-green-500'
            }`}
          >
            <span className="sr-only">
              {conflictStatus?.hasConflicts
                ? 'Warning: conflicts detected'
                : 'Status: active and healthy'}
            </span>
          </span>
          <Text size="sm" c="dimmed">
            {conflictStatus?.hasConflicts ? 'Conflicts detected' : 'Worktree active'}
          </Text>
        </Group>
        <Group gap="sm">
          {status && (
            <>
              {status.aheadBehind.ahead > 0 && (
                <Badge variant="light" color="blue" leftSection={<ArrowUp className="h-3 w-3" />}>
                  {status.aheadBehind.ahead} ahead
                </Badge>
              )}
              {status.aheadBehind.behind > 0 && (
                <Badge
                  variant="light"
                  color="yellow"
                  leftSection={<ArrowDown className="h-3 w-3" />}
                >
                  {status.aheadBehind.behind} behind
                </Badge>
              )}
              {status.hasChanges && (
                <Badge variant="light" color="gray" leftSection={<FileCode className="h-3 w-3" />}>
                  {status.changedFiles} changed
                </Badge>
              )}
            </>
          )}
        </Group>
      </Group>

      {/* Action buttons */}
      <Group gap="xs">
        <Button
          variant="outline"
          size="xs"
          onClick={handleOpenInVSCode}
          leftSection={<ExternalLink className="h-3 w-3" />}
        >
          Open in VS Code
        </Button>

        {/* PR Button - show View PR if exists, Create PR if not */}
        {hasPR ? (
          <Button
            variant="outline"
            size="xs"
            onClick={handleOpenPR}
            leftSection={<GitPullRequest className="h-3 w-3" />}
          >
            View PR #{task.git?.prNumber}
          </Button>
        ) : (
          status &&
          status.aheadBehind.ahead > 0 &&
          ghStatus?.authenticated && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPrDialogOpen(true)}
              leftSection={<GitPullRequest className="h-3 w-3" />}
            >
              Create PR
            </Button>
          )
        )}

        {status && status.aheadBehind.behind > 0 && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => rebaseWorktree.mutate(task.id)}
            disabled={rebaseWorktree.isPending}
            leftSection={
              rebaseWorktree.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )
            }
          >
            Rebase
          </Button>
        )}

        {status && status.aheadBehind.ahead > 0 && !status.hasChanges && (
          <Button
            color="green"
            size="xs"
            onClick={() => setMergeDialogOpen(true)}
            leftSection={<GitMerge className="h-3 w-3" />}
          >
            Merge
          </Button>
        )}

        <Button
          variant="subtle"
          color="gray"
          size="xs"
          onClick={() => setDeleteDialogOpen(true)}
          leftSection={<Trash2 className="h-3 w-3" />}
        >
          Delete Worktree
        </Button>
      </Group>

      {/* Worktree path */}
      <Code className="truncate" color="dark">
        {task.git.worktreePath}
      </Code>

      {/* Conflict Resolver */}
      <ConflictResolver
        task={task}
        open={conflictResolverOpen}
        onOpenChange={setConflictResolverOpen}
      />

      {/* PR Dialog */}
      <PRDialog task={task} open={prDialogOpen} onOpenChange={setPrDialogOpen} />

      <Modal
        opened={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        title={`Merge to ${task.git?.baseBranch}?`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This will merge {task.git?.branch} into {task.git?.baseBranch}, push to remote, delete
            the worktree, and mark the task as Done.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              color="green"
              onClick={() => {
                mergeWorktree.mutate(task.id);
                setMergeDialogOpen(false);
              }}
              disabled={mergeWorktree.isPending}
            >
              {mergeWorktree.isPending ? 'Merging...' : 'Merge & Complete'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete worktree?"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {status?.hasChanges
              ? 'Warning: This worktree has uncommitted changes that will be lost.'
              : 'This will remove the worktree but keep the branch.'}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                deleteWorktree.mutate({
                  taskId: task.id,
                  force: status?.hasChanges,
                });
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
