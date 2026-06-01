import { ArrowLeft } from 'lucide-react';
import { ActionIcon, Drawer, Group, ScrollArea, Stack, Title } from '@mantine/core';

export type DrillDownType = 'tasks' | 'errors' | 'tokens' | 'duration' | null;

interface DrillDownPanelProps {
  type: DrillDownType;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function DrillDownPanel({ type, title, onClose, children }: DrillDownPanelProps) {
  return (
    <Drawer
      opened={type !== null}
      onClose={onClose}
      position="right"
      size={600}
      withCloseButton={false}
      classNames={{ body: 'h-full overflow-hidden' }}
    >
      <Stack h="100%" gap={0}>
        <Group gap="sm" className="flex-shrink-0">
          <ActionIcon aria-label="Close drilldown" variant="subtle" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </ActionIcon>
          <Title order={2} className="text-lg">
            {title}
          </Title>
        </Group>

        <ScrollArea className="mt-4 flex-1" type="auto">
          {children}
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}
