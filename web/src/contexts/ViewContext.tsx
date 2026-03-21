import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

export type AppView =
  | 'board'
  | 'activity'
  | 'backlog'
  | 'archive'
  | 'templates'
  | 'workflows'
  | 'decisions';

const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

const VIEW_PATHS: Record<AppView, string> = {
  board: '/',
  activity: '/activity',
  backlog: '/backlog',
  archive: '/archive',
  templates: '/templates',
  workflows: '/workflows',
  decisions: '/decisions',
};

function getViewFromPath(pathname: string): AppView {
  const relativePath =
    BASE_PATH && pathname.startsWith(BASE_PATH)
      ? pathname.slice(BASE_PATH.length) || '/'
      : pathname;
  const normalized = relativePath.replace(/\/+$/, '') || '/';
  const match = Object.entries(VIEW_PATHS).find(([, path]) => path === normalized);
  return (match?.[0] as AppView | undefined) ?? 'board';
}

interface ViewContextValue {
  view: AppView;
  setView: (view: AppView) => void;
  /** Navigate to a specific task by opening the board and setting selectedTaskId. */
  navigateToTask: (taskId: string) => void;
  /** The task ID requested by view navigation (consumed once by the board). */
  pendingTaskId: string | null;
  clearPendingTask: () => void;
}

const ViewContext = createContext<ViewContextValue>({
  view: 'board',
  setView: () => {},
  navigateToTask: () => {},
  pendingTaskId: null,
  clearPendingTask: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === 'undefined') return 'board';
    return getViewFromPath(window.location.pathname);
  });
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const navigateToTask = useCallback((taskId: string) => {
    setPendingTaskId(taskId);
    setView('board');
  }, []);

  const clearPendingTask = useCallback(() => {
    setPendingTaskId(null);
  }, []);

  const value = useMemo(
    () => ({ view, setView, navigateToTask, pendingTaskId, clearPendingTask }),
    [view, navigateToTask, pendingTaskId, clearPendingTask]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetPath = `${BASE_PATH}${VIEW_PATHS[view]}`.replace(/\/+$/, '') || '/';
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentPath !== targetPath) {
      window.history.replaceState(
        {},
        '',
        `${targetPath}${window.location.search}${window.location.hash}`
      );
    }
  }, [view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => setView(getViewFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  return useContext(ViewContext);
}
