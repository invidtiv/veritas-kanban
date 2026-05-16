import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTaskTypes, getTypeIcon } from '@/hooks/useTaskTypes';
import { useFeatureSettings } from '@/hooks/useFeatureSettings';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { TaskDetailsTab } from './detail/TaskDetailsTab';
import { ProgressTab } from './detail/ProgressTab';
import { GitSection } from './GitSection';
import { AgentPanel } from './AgentPanel';
import { DiffViewer } from './DiffViewer';
import { ReviewPanel } from './ReviewPanel';
import { PreviewPanel } from './PreviewPanel';
import { AttachmentsSection } from './AttachmentsSection';
import { ObservationsSection } from './ObservationsSection';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
import { TaskMetricsPanel } from './TaskMetricsPanel';
import { WorkflowSection } from './WorkflowSection';
import FeatureErrorBoundary from '@/components/shared/FeatureErrorBoundary';
import {
  GitBranch,
  Bot,
  FileDiff,
  ClipboardCheck,
  Monitor,
  FileCode,
  Paperclip,
  Archive,
  BarChart3,
  MessageSquare,
  NotebookPen,
  Workflow,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import type { Task, ReviewComment, ReviewState } from '@veritas-kanban/shared';
import { useAddObservation, useDeleteObservation } from '@/hooks/useTasks';

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onRestore?: (taskId: string) => void;
}

type TaskDetailTabId =
  | 'details'
  | 'progress'
  | 'observations'
  | 'attachments'
  | 'git'
  | 'agent'
  | 'changes'
  | 'review'
  | 'metrics';

interface TaskDetailTabDefinition {
  id: TaskDetailTabId;
  label: string;
  Icon?: LucideIcon;
  fallbackTitle?: string;
  codeOnly?: boolean;
  feature?: 'attachments';
  disabledWithoutWorktree?: boolean;
}

const TASK_DETAIL_TABS: readonly TaskDetailTabDefinition[] = [
  { id: 'details', label: 'Details' },
  {
    id: 'progress',
    label: 'Progress',
    Icon: NotebookPen,
    fallbackTitle: 'Progress section failed to load',
  },
  {
    id: 'observations',
    label: 'Observations',
    Icon: Eye,
    fallbackTitle: 'Observations section failed to load',
  },
  {
    id: 'attachments',
    label: 'Attachments',
    Icon: Paperclip,
    fallbackTitle: 'Attachments section failed to load',
    feature: 'attachments',
  },
  {
    id: 'git',
    label: 'Git',
    Icon: GitBranch,
    fallbackTitle: 'Git section failed to load',
    codeOnly: true,
  },
  {
    id: 'agent',
    label: 'Agent',
    Icon: Bot,
    fallbackTitle: 'Agent panel failed to load',
    codeOnly: true,
  },
  {
    id: 'changes',
    label: 'Changes',
    Icon: FileDiff,
    fallbackTitle: 'Changes viewer failed to load',
    codeOnly: true,
    disabledWithoutWorktree: true,
  },
  {
    id: 'review',
    label: 'Review',
    Icon: ClipboardCheck,
    fallbackTitle: 'Review panel failed to load',
    codeOnly: true,
  },
  {
    id: 'metrics',
    label: 'Metrics',
    Icon: BarChart3,
    fallbackTitle: 'Metrics panel failed to load',
  },
];

export function TaskDetailPanel({
  task,
  open,
  onOpenChange,
  readOnly = false,
  onRestore,
}: TaskDetailPanelProps) {
  const { data: taskTypes = [] } = useTaskTypes();
  const { settings: featureSettings } = useFeatureSettings();
  const taskSettings = featureSettings.tasks;
  const agentSettings = featureSettings.agents;
  const { localTask, updateField, isDirty } = useDebouncedSave(task);
  const [activeTab, setActiveTab] = useState('details');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [taskChatOpen, setTaskChatOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const addObservation = useAddObservation();
  const deleteObservation = useDeleteObservation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const isCodeTask = localTask?.type === 'code';
  const hasWorktree = !!localTask?.git?.worktreePath;
  const visibleTabs = useMemo(
    () =>
      TASK_DETAIL_TABS.filter((tab) => {
        if (tab.codeOnly && !isCodeTask) return false;
        if (tab.feature === 'attachments' && !taskSettings.enableAttachments) return false;
        return true;
      }).map((tab) => ({
        ...tab,
        disabled: tab.disabledWithoutWorktree && !hasWorktree,
      })),
    [hasWorktree, isCodeTask, taskSettings.enableAttachments]
  );

  useEffect(() => {
    const activeTabAvailable = visibleTabs.some((tab) => tab.id === activeTab && !tab.disabled);
    if (!activeTabAvailable) {
      setActiveTab('details');
    }
  }, [activeTab, visibleTabs]);

  if (!localTask) return null;

  // Get current type info
  const currentType = taskTypes.find((t) => t.id === localTask.type);
  const TypeIconComponent = currentType ? getTypeIcon(currentType.icon) : null;
  const typeLabel = currentType ? currentType.label : localTask.type;
  const renderTabContent = (tabId: TaskDetailTabId) => {
    switch (tabId) {
      case 'details':
        return (
          <TaskDetailsTab
            task={localTask}
            onUpdate={updateField}
            onClose={() => onOpenChange(false)}
            readOnly={readOnly}
            onRestore={onRestore}
          />
        );
      case 'progress':
        return <ProgressTab task={localTask} />;
      case 'observations':
        return (
          <ObservationsSection
            task={localTask}
            onAddObservation={async (data) => {
              await addObservation.mutateAsync({ taskId: localTask.id, data });
            }}
            onDeleteObservation={async (observationId) => {
              await deleteObservation.mutateAsync({
                taskId: localTask.id,
                observationId,
              });
            }}
          />
        );
      case 'attachments':
        return <AttachmentsSection task={localTask} />;
      case 'git':
        return (
          <GitSection
            task={localTask}
            onGitChange={(git) => updateField('git', git as Task['git'])}
          />
        );
      case 'agent':
        return <AgentPanel task={localTask} />;
      case 'changes':
        if (!hasWorktree) return null;
        return (
          <DiffViewer
            task={localTask}
            onAddComment={(comment: ReviewComment) => {
              const newComments = [...(localTask.reviewComments || []), comment];
              updateField('reviewComments', newComments);
            }}
            onRemoveComment={(commentId: string) => {
              const newComments = (localTask.reviewComments || []).filter(
                (comment) => comment.id !== commentId
              );
              updateField('reviewComments', newComments.length > 0 ? newComments : undefined);
            }}
          />
        );
      case 'review':
        return (
          <ReviewPanel
            task={localTask}
            onReview={(review: ReviewState) => {
              updateField('review', Object.keys(review).length > 0 ? review : undefined);
            }}
            onMergeComplete={() => onOpenChange(false)}
          />
        );
      case 'metrics':
        return <TaskMetricsPanel task={localTask} />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[700px] sm:max-w-[700px] overflow-hidden flex flex-col p-0"
        aria-label={`Task details: ${localTask.title}`}
      >
        <SheetHeader className="space-y-1 flex-shrink-0 border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            {TypeIconComponent && <TypeIconComponent className="h-4 w-4" />}
            <span className="text-xs uppercase tracking-wide">{typeLabel} Task</span>
            {readOnly && (
              <Badge variant="secondary" className="flex items-center gap-1 ml-auto">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
            {!readOnly && isDirty && (
              <span className="text-xs text-amber-500 ml-auto">Saving...</span>
            )}
          </div>
          <SheetTitle className="pr-8">
            {readOnly ? (
              <span className="text-xl font-semibold">{localTask.title}</span>
            ) : (
              <Input
                value={localTask.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
                placeholder="Task title..."
                aria-label="Task title"
              />
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Action buttons above tabs */}
        <div className="grid grid-cols-3 gap-2 px-6 pt-4 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTaskChatOpen(true)}
            className="flex items-center justify-center gap-1 w-full"
          >
            <MessageSquare className="h-3 w-3" />
            Chat
          </Button>
          {!readOnly ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApplyTemplateOpen(true)}
                className="flex items-center justify-center gap-1 w-full"
              >
                <FileCode className="h-3 w-3" />
                Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkflowOpen(true)}
                className="flex items-center justify-center gap-1 w-full"
              >
                <Workflow className="h-3 w-3" />
                Workflow
              </Button>
            </>
          ) : (
            <>
              <div />
              <div />
            </>
          )}
          {!readOnly && isCodeTask && localTask.git?.repo && agentSettings.enablePreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="flex items-center justify-center gap-1 w-full col-span-2"
            >
              <Monitor className="h-3 w-3" />
              Preview
            </Button>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden px-6 pt-3 pb-6"
        >
          <TabsList className="w-full flex-shrink-0 justify-start overflow-x-auto">
            {visibleTabs.map((tab) => {
              const Icon = tab.Icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className="flex-none px-3"
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            {visibleTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                {tab.fallbackTitle ? (
                  <FeatureErrorBoundary fallbackTitle={tab.fallbackTitle}>
                    {renderTabContent(tab.id)}
                  </FeatureErrorBoundary>
                ) : (
                  renderTabContent(tab.id)
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </SheetContent>

      {/* Preview Panel */}
      {localTask && (
        <PreviewPanel task={localTask} open={previewOpen} onOpenChange={setPreviewOpen} />
      )}

      {/* Apply Template Dialog */}
      {localTask && (
        <ApplyTemplateDialog
          task={localTask}
          open={applyTemplateOpen}
          onOpenChange={setApplyTemplateOpen}
        />
      )}

      {/* Task-Scoped Chat Panel */}
      {localTask && (
        <ChatPanel open={taskChatOpen} onOpenChange={setTaskChatOpen} taskId={localTask.id} />
      )}

      {/* Workflow Section */}
      {localTask && (
        <WorkflowSection task={localTask} open={workflowOpen} onOpenChange={setWorkflowOpen} />
      )}
    </Sheet>
  );
}
