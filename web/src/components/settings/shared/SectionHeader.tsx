import { useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { RotateCcw } from 'lucide-react';

export function SectionHeader({ title, onReset }: { title: string; onReset?: () => void }) {
  const [resetOpen, setResetOpen] = useState(false);

  const handleReset = () => {
    onReset?.();
    setResetOpen(false);
  };

  return (
    <Group justify="space-between" align="center" className="mb-2 border-b pb-2">
      <Text size="sm" fw={600} c="dimmed" tt="uppercase">
        {title}
      </Text>
      {onReset && (
        <>
          <Button
            type="button"
            variant="subtle"
            size="xs"
            color="gray"
            leftSection={<RotateCcw className="h-3 w-3" />}
            onClick={() => setResetOpen(true)}
          >
            Reset
          </Button>
          <Modal
            opened={resetOpen}
            onClose={() => setResetOpen(false)}
            title="Reset to defaults?"
            centered
          >
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                This will reset all {title.toLowerCase()} settings to their default values.
              </Text>
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReset}>Reset</Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </Group>
  );
}
