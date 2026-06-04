import type { BoardSavedView, BoardSavedViewFilters } from '@veritas-kanban/shared';

export const EMPTY_BOARD_VIEW_FILTERS: BoardSavedViewFilters = {
  search: '',
  project: null,
  type: null,
  agent: null,
};

export function normalizeBoardViewFilters(
  filters: Partial<BoardSavedViewFilters>
): BoardSavedViewFilters {
  return {
    search: filters.search?.trim() ?? '',
    project: normalizeNullableFilter(filters.project),
    type: normalizeNullableFilter(filters.type),
    agent: normalizeNullableFilter(filters.agent),
  };
}

export function areBoardViewFiltersEqual(
  a: Partial<BoardSavedViewFilters>,
  b: Partial<BoardSavedViewFilters>
): boolean {
  const normalizedA = normalizeBoardViewFilters(a);
  const normalizedB = normalizeBoardViewFilters(b);
  return (
    normalizedA.search === normalizedB.search &&
    normalizedA.project === normalizedB.project &&
    normalizedA.type === normalizedB.type &&
    normalizedA.agent === normalizedB.agent
  );
}

export function hasBoardViewFilters(filters: Partial<BoardSavedViewFilters>): boolean {
  const normalized = normalizeBoardViewFilters(filters);
  return Boolean(normalized.search || normalized.project || normalized.type || normalized.agent);
}

export function hasBoardFilterSearchParams(params: URLSearchParams): boolean {
  return ['q', 'project', 'type', 'agent'].some((key) => params.has(key));
}

export function findBoardSavedViewByFilters(
  savedViews: BoardSavedView[],
  filters: Partial<BoardSavedViewFilters>
): BoardSavedView | undefined {
  return savedViews.find((view) => areBoardViewFiltersEqual(view.filters, filters));
}

export function createBoardSavedView({
  name,
  filters,
  existingIds = [],
  now = new Date(),
}: {
  name: string;
  filters: Partial<BoardSavedViewFilters>;
  existingIds?: string[];
  now?: Date;
}): BoardSavedView {
  const normalizedName = normalizeBoardViewName(name);
  const timestamp = now.toISOString();
  return {
    id: uniqueBoardSavedViewId(normalizedName, existingIds, now),
    name: normalizedName,
    filters: normalizeBoardViewFilters(filters),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function renameBoardSavedView(
  savedViews: BoardSavedView[],
  viewId: string,
  name: string,
  now = new Date()
): BoardSavedView[] {
  const normalizedName = normalizeBoardViewName(name);
  return savedViews.map((view) =>
    view.id === viewId ? { ...view, name: normalizedName, updatedAt: now.toISOString() } : view
  );
}

export function updateBoardSavedViewFilters(
  savedViews: BoardSavedView[],
  viewId: string,
  filters: Partial<BoardSavedViewFilters>,
  now = new Date()
): BoardSavedView[] {
  return savedViews.map((view) =>
    view.id === viewId
      ? { ...view, filters: normalizeBoardViewFilters(filters), updatedAt: now.toISOString() }
      : view
  );
}

export function deleteBoardSavedView(
  savedViews: BoardSavedView[],
  defaultSavedViewId: string | null,
  viewId: string
): { savedViews: BoardSavedView[]; defaultSavedViewId: string | null } {
  return {
    savedViews: savedViews.filter((view) => view.id !== viewId),
    defaultSavedViewId: defaultSavedViewId === viewId ? null : defaultSavedViewId,
  };
}

function normalizeNullableFilter(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeBoardViewName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Saved board view name is required');
  }
  return normalized.slice(0, 80);
}

function uniqueBoardSavedViewId(name: string, existingIds: string[], now: Date): string {
  const existing = new Set(existingIds);
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
  const base = `view-${stamp}-${slug || 'board'}`;
  let candidate = base;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}
