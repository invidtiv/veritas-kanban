import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useCreateTemplate, useUpdateTemplate, type TaskTemplate } from '@/hooks/useTemplates';
import { useTaskTypesManager, getTypeIcon } from '@/hooks/useTaskTypes';
import { useToast } from '@/hooks/useToast';
import { TEMPLATE_CATEGORIES, getCategoryIcon } from '@/lib/template-categories';
import type { TaskPriority, AgentType } from '@veritas-kanban/shared';
import { Loader2 } from 'lucide-react';

interface TemplateEditorDialogProps {
  template: TaskTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateEditorDialog({ template, open, onOpenChange }: TemplateEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [project, setProject] = useState('');
  const [agent, setAgent] = useState<AgentType | ''>('');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');

  const { toast } = useToast();
  const { items: taskTypes } = useTaskTypesManager();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isLoading = createTemplate.isPending || updateTemplate.isPending;
  const categoryOptions = Object.entries(TEMPLATE_CATEGORIES).map(([key, { label }]) => ({
    value: key,
    label: `${getCategoryIcon(key)} ${label}`,
  }));
  const taskTypeOptions = taskTypes.map((taskType) => ({
    value: taskType.id,
    label: taskType.label,
    icon: taskType.icon,
  }));
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];
  const agentOptions = [
    { value: 'claude-opus-4', label: 'Claude Opus 4' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'gpt-4', label: 'GPT-4' },
  ];

  // Populate form when editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setCategory(template.category || '');
      setType(template.taskDefaults?.type || '');
      setPriority((template.taskDefaults?.priority as TaskPriority) || '');
      setProject(template.taskDefaults?.project || '');
      setAgent((template.taskDefaults?.agent as AgentType) || '');
      setDescriptionTemplate(template.taskDefaults?.descriptionTemplate || '');
    } else {
      resetForm();
    }
  }, [template, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('');
    setType('');
    setPriority('');
    setProject('');
    setAgent('');
    setDescriptionTemplate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const input = {
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        taskDefaults: {
          type: type || undefined,
          priority: priority || undefined,
          project: project.trim() || undefined,
          agent: agent || undefined,
          descriptionTemplate: descriptionTemplate.trim() || undefined,
        },
      };

      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, input });
        toast({
          title: 'Success',
          description: `Template "${name}" updated successfully.`,
        });
      } else {
        await createTemplate.mutateAsync(input);
        toast({
          title: 'Success',
          description: `Template "${name}" created successfully.`,
        });
      }

      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title={template ? 'Edit Template' : 'Create New Template'}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs defaultValue="basic" className="w-full">
            <Tabs.List grow>
              <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
              <Tabs.Tab value="defaults">Task Defaults</Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <TextInput
                  id="name"
                  label={
                    <>
                      Template Name <span className="text-destructive">*</span>
                    </>
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bug Fix, Feature Implementation"
                  required
                />

                <Textarea
                  id="description"
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this template used for?"
                  rows={3}
                />

                <Select
                  id="category"
                  label="Category"
                  value={category || null}
                  onChange={(value) => setCategory(value ?? '')}
                  data={categoryOptions}
                  placeholder="Select a category..."
                />
              </div>
            </Tabs.Panel>

            {/* Task Defaults Tab */}
            <Tabs.Panel value="defaults" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    id="type"
                    label="Default Type"
                    value={type || null}
                    onChange={(value) => setType(value ?? '')}
                    data={taskTypeOptions}
                    placeholder="Any"
                    renderOption={({ option }) => {
                      const iconName = taskTypeOptions.find(
                        (entry) => entry.value === option.value
                      )?.icon;
                      const IconComponent = iconName ? getTypeIcon(iconName) : null;
                      return (
                        <Group gap="xs">
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          <span>{option.label}</span>
                        </Group>
                      );
                    }}
                  />

                  <Select
                    id="priority"
                    label="Default Priority"
                    value={priority || null}
                    onChange={(value) => setPriority((value as TaskPriority | null) ?? '')}
                    data={priorityOptions}
                    placeholder="None"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    id="project"
                    label="Default Project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g., VK-001"
                  />

                  <Select
                    id="agent"
                    label="Default Agent"
                    value={agent || null}
                    onChange={(value) => setAgent((value as AgentType | null) ?? '')}
                    data={agentOptions}
                    placeholder="None"
                  />
                </div>

                <div className="grid gap-2">
                  <Textarea
                    id="descriptionTemplate"
                    label="Description Template"
                    value={descriptionTemplate}
                    onChange={(e) => setDescriptionTemplate(e.target.value)}
                    placeholder="Template for task description (can include variables like {{date}}, {{project}})"
                    rows={4}
                  />
                  <Text size="xs" c="dimmed">
                    Tip: Use variables like {'{{date}}'} to auto-populate values
                  </Text>
                </div>
              </div>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {template ? 'Update Template' : 'Create Template'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
