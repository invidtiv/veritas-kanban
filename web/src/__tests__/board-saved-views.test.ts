import { describe, expect, it } from 'vitest';
import {
  createBoardSavedView,
  deleteBoardSavedView,
  findBoardSavedViewByFilters,
  renameBoardSavedView,
  updateBoardSavedViewFilters,
} from '@/lib/board-saved-views';
import { filtersToSearchParams, searchParamsToFilters } from '@/components/board/FilterBar';

describe('board saved views', () => {
  it('creates normalized saved views that round-trip through board URL filters', () => {
    const view = createBoardSavedView({
      name: '  Sprint Focus  ',
      filters: {
        search: ' docs ',
        project: ' veritas ',
        type: ' feature ',
        agent: ' codex ',
      },
      now: new Date('2026-06-03T12:30:45.000Z'),
    });

    expect(view).toEqual({
      id: 'view-20260603123045-sprint-focus',
      name: 'Sprint Focus',
      filters: {
        search: 'docs',
        project: 'veritas',
        type: 'feature',
        agent: 'codex',
      },
      createdAt: '2026-06-03T12:30:45.000Z',
      updatedAt: '2026-06-03T12:30:45.000Z',
    });

    const params = filtersToSearchParams(view.filters);

    expect(params.toString()).toBe('q=docs&project=veritas&type=feature&agent=codex');
    expect(searchParamsToFilters(params)).toEqual(view.filters);
  });

  it('finds, renames, and updates views by normalized filters', () => {
    const created = createBoardSavedView({
      name: 'Needs Review',
      filters: { search: ' review ', project: null, type: null, agent: null },
      now: new Date('2026-06-03T12:30:45.000Z'),
    });

    const renamed = renameBoardSavedView(
      [created],
      created.id,
      'Review Queue',
      new Date('2026-06-03T12:35:00.000Z')
    );
    const updated = updateBoardSavedViewFilters(
      renamed,
      created.id,
      { search: 'review', project: 'veritas', type: 'bug', agent: null },
      new Date('2026-06-03T12:40:00.000Z')
    );

    expect(updated[0]).toMatchObject({
      name: 'Review Queue',
      filters: { search: 'review', project: 'veritas', type: 'bug', agent: null },
      updatedAt: '2026-06-03T12:40:00.000Z',
    });
    expect(
      findBoardSavedViewByFilters(updated, {
        search: ' review ',
        project: ' veritas ',
        type: ' bug ',
      })?.id
    ).toBe(created.id);
  });

  it('clears the default pointer when deleting the default saved view', () => {
    const defaultView = createBoardSavedView({
      name: 'Default',
      filters: { search: '', project: 'veritas', type: null, agent: null },
      now: new Date('2026-06-03T12:30:45.000Z'),
    });
    const otherView = createBoardSavedView({
      name: 'Other',
      filters: { search: 'docs', project: null, type: null, agent: null },
      existingIds: [defaultView.id],
      now: new Date('2026-06-03T12:31:45.000Z'),
    });

    const result = deleteBoardSavedView([defaultView, otherView], defaultView.id, defaultView.id);

    expect(result.savedViews).toEqual([otherView]);
    expect(result.defaultSavedViewId).toBeNull();
  });
});
