export type AppView =
  | 'board'
  | 'activity'
  | 'backlog'
  | 'archive'
  | 'templates'
  | 'workflows'
  | 'policies'
  | 'drift'
  | 'decisions'
  | 'scoring';

export type NavigationView = Exclude<AppView, 'board'>;

export type ViewIcon =
  | 'Activity'
  | 'Archive'
  | 'FileText'
  | 'GitBranch'
  | 'Inbox'
  | 'LayoutDashboard'
  | 'ListOrdered'
  | 'Scale'
  | 'ShieldAlert'
  | 'Workflow';

export interface ViewDefinition {
  view: AppView;
  path: string;
  label: string;
  title?: string;
  commandLabel: string;
  loadingLabel?: string;
  icon: ViewIcon;
  keywords: readonly string[];
}

export const VIEW_DEFINITIONS: readonly ViewDefinition[] = [
  {
    view: 'board',
    path: '/',
    label: 'Board',
    commandLabel: 'Go to Board',
    icon: 'LayoutDashboard',
    keywords: ['kanban', 'home', 'main'],
  },
  {
    view: 'activity',
    path: '/activity',
    label: 'Activity',
    commandLabel: 'Go to Activity',
    loadingLabel: 'Loading activity feed...',
    icon: 'ListOrdered',
    keywords: ['feed', 'log', 'history'],
  },
  {
    view: 'backlog',
    path: '/backlog',
    label: 'Backlog',
    commandLabel: 'Go to Backlog',
    loadingLabel: 'Loading backlog...',
    icon: 'Inbox',
    keywords: ['someday', 'maybe', 'later'],
  },
  {
    view: 'archive',
    path: '/archive',
    label: 'Archive',
    commandLabel: 'Go to Archive',
    loadingLabel: 'Loading archive...',
    icon: 'Archive',
    keywords: ['done', 'completed', 'old'],
  },
  {
    view: 'templates',
    path: '/templates',
    label: 'Templates',
    commandLabel: 'Go to Templates',
    loadingLabel: 'Loading templates...',
    icon: 'FileText',
    keywords: ['templates', 'repeatable', 'task'],
  },
  {
    view: 'workflows',
    path: '/workflows',
    label: 'Workflows',
    commandLabel: 'Go to Workflows',
    loadingLabel: 'Loading workflows...',
    icon: 'Workflow',
    keywords: ['automation', 'runs', 'workflow'],
  },
  {
    view: 'drift',
    path: '/drift',
    label: 'Drift Monitor',
    commandLabel: 'Go to Drift Monitor',
    loadingLabel: 'Loading drift monitor...',
    icon: 'Activity',
    keywords: ['behavior', 'anomaly', 'z-score', 'alerts'],
  },
  {
    view: 'decisions',
    path: '/decisions',
    label: 'Decisions',
    title: 'Decision Audit Trail',
    commandLabel: 'Go to Decisions',
    loadingLabel: 'Loading decisions...',
    icon: 'GitBranch',
    keywords: ['audit', 'reasoning', 'assumptions'],
  },
  {
    view: 'scoring',
    path: '/scoring',
    label: 'Scoring',
    commandLabel: 'Go to Scoring',
    loadingLabel: 'Loading scoring...',
    icon: 'Scale',
    keywords: ['score', 'prioritize', 'value'],
  },
  {
    view: 'policies',
    path: '/policies',
    label: 'Policies',
    commandLabel: 'Go to Policies',
    loadingLabel: 'Loading policies...',
    icon: 'ShieldAlert',
    keywords: ['governance', 'rules', 'guardrails'],
  },
];

export const VIEW_PATHS = Object.fromEntries(
  VIEW_DEFINITIONS.map((definition) => [definition.view, definition.path])
) as Record<AppView, string>;

export const VIEW_BY_ID = Object.fromEntries(
  VIEW_DEFINITIONS.map((definition) => [definition.view, definition])
) as Record<AppView, ViewDefinition>;

export const NAVIGATION_VIEWS = VIEW_DEFINITIONS.filter(
  (definition): definition is ViewDefinition & { view: NavigationView } =>
    definition.view !== 'board'
);
