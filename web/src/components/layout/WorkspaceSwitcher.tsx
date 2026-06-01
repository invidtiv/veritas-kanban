import { useState } from 'react';
import { Badge, Group, Select, Text } from '@mantine/core';
import { Building2, Loader2 } from 'lucide-react';
import { useIdentity } from '@/hooks/useIdentity';

export function WorkspaceSwitcher() {
  const { activeWorkspace, activeMembership, activeWorkspaceId, workspaces, switchWorkspace } =
    useIdentity();
  const [isSwitching, setIsSwitching] = useState(false);

  if (workspaces.length === 0) {
    return (
      <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="h-4 w-4" aria-hidden="true" />
        Workspace unavailable
      </div>
    );
  }

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;
    setIsSwitching(true);
    try {
      await switchWorkspace(workspaceId);
    } finally {
      setIsSwitching(false);
    }
  };

  const workspaceOptions = workspaces.map(({ workspace }) => ({
    value: workspace.id,
    label: workspace.name,
  }));
  const roleByWorkspaceId = new Map(
    workspaces.map(({ workspace, membership }) => [workspace.id, membership.role])
  );

  return (
    <div className="hidden md:flex items-center gap-2">
      <Select
        aria-label="Workspace"
        value={activeWorkspaceId ?? null}
        onChange={(workspaceId) => {
          if (workspaceId) void handleSwitch(workspaceId);
        }}
        data={workspaceOptions}
        placeholder={activeWorkspace?.name ?? 'Workspace'}
        disabled={isSwitching}
        allowDeselect={false}
        checkIconPosition="right"
        className="w-[190px]"
        classNames={{
          input: 'h-8 bg-background/60 text-xs',
          dropdown: 'bg-popover text-popover-foreground',
          option: 'text-xs',
        }}
        leftSection={<Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        rightSection={
          isSwitching ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : undefined
        }
        renderOption={({ option }) => (
          <Group gap="xs" justify="space-between" wrap="nowrap" className="w-full">
            <Text span size="xs" truncate>
              {option.label}
            </Text>
            <Text span size="xs" c="dimmed" className="capitalize">
              {roleByWorkspaceId.get(option.value)}
            </Text>
          </Group>
        )}
      />
      {activeMembership && (
        <Badge variant="light" color="gray" size="xs" className="hidden lg:inline-flex capitalize">
          {activeMembership.role}
        </Badge>
      )}
    </div>
  );
}
