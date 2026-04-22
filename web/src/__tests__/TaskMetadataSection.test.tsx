import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TaskMetadataSection } from '@/components/task/detail/TaskMetadataSection';
import { createMockTask, renderWithProviders } from './test-utils';

vi.mock('@/hooks/useTaskTypes', () => ({
  useTaskTypes: () => ({
    data: [
      {
        id: 'code',
        label: 'Code',
        icon: 'Code',
      },
    ],
  }),
  getTypeIcon: () => null,
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useSprints', () => ({
  useSprints: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => ({
    data: {
      agents: [
        { type: 'claude-code', name: 'Claude Code', enabled: true },
        { type: 'frontend-agent', name: 'Frontend Agent', enabled: false },
      ],
    },
  }),
}));

describe('TaskMetadataSection', () => {
  it('shows assigned agent and creator metadata', () => {
    const task = createMockTask({
      type: 'code',
      agent: 'claude-code',
      createdBy: 'frontend-agent',
    });

    renderWithProviders(<TaskMetadataSection task={task} onUpdate={vi.fn()} />);

    expect(screen.getByText('Assigned Agent')).toBeTruthy();
    expect(screen.getByText('Created By')).toBeTruthy();
    expect(screen.getAllByText('Claude Code').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Frontend Agent').length).toBeGreaterThan(0);
  });

  it('resolves disabled configured agents for creator labels', () => {
    const task = createMockTask({
      type: 'code',
      createdBy: 'frontend-agent',
    });

    renderWithProviders(<TaskMetadataSection task={task} onUpdate={vi.fn()} />);

    expect(screen.getAllByText('Frontend Agent').length).toBeGreaterThan(0);
  });

  it('shows a human-friendly label for session creators', () => {
    const task = createMockTask({
      type: 'code',
      agent: undefined,
      createdBy: 'session',
    });

    renderWithProviders(<TaskMetadataSection task={task} onUpdate={vi.fn()} />);

    expect(screen.getAllByText('Auto (routing)').length).toBeGreaterThan(0);
    expect(screen.getByText('Human (session)')).toBeTruthy();
  });
});
