import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import type { TaskTemplate } from '@/hooks/useTemplates';

interface BlueprintPreviewProps {
  template: TaskTemplate;
}

export function BlueprintPreview({ template }: BlueprintPreviewProps) {
  if (!template.blueprint || template.blueprint.length === 0) {
    return null;
  }

  return (
    <Paper className="bg-muted/30 p-3" radius="md" withBorder>
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" color="blue" variant="light">
          <AlertCircle className="h-4 w-4" />
        </ThemeIcon>
        <Text size="sm" fw={500}>
          Blueprint: Multiple Tasks
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        This template will create {template.blueprint.length} linked tasks.
      </Text>
      <Stack gap="xs">
        {template.blueprint.map((bt, idx) => (
          <div key={bt.refId} className="text-sm border-l-2 border-primary/50 pl-3 py-1">
            <Text size="sm" fw={500}>
              {idx + 1}. {bt.title}
            </Text>
            {bt.blockedByRefs && bt.blockedByRefs.length > 0 && (
              <Text size="xs" c="dimmed">
                Blocked by: {bt.blockedByRefs.join(', ')}
              </Text>
            )}
            {bt.subtaskTemplates && bt.subtaskTemplates.length > 0 && (
              <Text size="xs" c="dimmed">
                {bt.subtaskTemplates.length} subtasks
              </Text>
            )}
          </div>
        ))}
      </Stack>
    </Paper>
  );
}
