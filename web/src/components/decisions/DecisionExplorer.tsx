import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, ShieldAlert, BrainCircuit } from 'lucide-react';
import { Badge, Button, Select, TextInput } from '@mantine/core';
import { useDecisions } from '@/hooks/useDecisions';
import type { DecisionListFilters, DecisionRecord } from '@veritas-kanban/shared';
import { DecisionDetail } from './DecisionDetail';

interface DecisionExplorerProps {
  onBack: () => void;
}

const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

function riskColor(riskScore: number): string {
  if (riskScore >= 75) return 'red';
  if (riskScore >= 40) return 'yellow';
  return 'green';
}

export function DecisionExplorer({ onBack }: DecisionExplorerProps) {
  const initialSelectedId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('decision')
      : null;

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [agent, setAgent] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filters = useMemo<DecisionListFilters>(() => {
    const next: DecisionListFilters = {};
    if (agent !== 'all') next.agent = agent;
    if (confidenceFilter === 'high') next.minConfidence = 80;
    if (confidenceFilter === 'medium') {
      next.minConfidence = 50;
      next.maxConfidence = 79;
    }
    if (confidenceFilter === 'low') next.maxConfidence = 49;
    if (riskFilter === 'high') next.minRisk = 70;
    if (riskFilter === 'medium') {
      next.minRisk = 40;
      next.maxRisk = 69;
    }
    if (riskFilter === 'low') next.maxRisk = 39;
    return next;
  }, [agent, confidenceFilter, riskFilter]);

  const { data: decisions = [], isLoading } = useDecisions(filters);

  const filteredDecisions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return decisions;
    return decisions.filter((decision) =>
      [decision.id, decision.agentId, decision.taskId, decision.inputContext, decision.outputAction]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [decisions, search]);

  const agentOptions = useMemo(
    () => Array.from(new Set(decisions.map((decision) => decision.agentId))).sort(),
    [decisions]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (selectedId) {
      params.set('decision', selectedId);
    } else {
      params.delete('decision');
    }
    const query = params.toString();
    window.history.replaceState({}, '', `${BASE_PATH}/decisions${query ? `?${query}` : ''}`);
  }, [selectedId]);

  if (selectedId) {
    return <DecisionDetail decisionId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="subtle" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Board
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Decision Audit Trail</h1>
            <p className="text-sm text-muted-foreground">
              Review agent reasoning, assumptions, and parent decision lineage.
            </p>
          </div>
        </div>
        <Badge variant="light" tt="none">
          {filteredDecisions.length} decisions
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_220px_220px_220px]">
        <div>
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search decision id, task, context..."
            leftSection={<Search className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        <Select
          value={agent}
          onChange={(value) => setAgent(value ?? 'all')}
          data={[
            { value: 'all', label: 'All agents' },
            ...agentOptions.map((option) => ({ value: option, label: option })),
          ]}
          placeholder="All agents"
          allowDeselect={false}
        />

        <Select
          value={confidenceFilter}
          onChange={(value) => setConfidenceFilter(value ?? 'all')}
          data={[
            { value: 'all', label: 'All confidence' },
            { value: 'high', label: '80-100' },
            { value: 'medium', label: '50-79' },
            { value: 'low', label: '0-49' },
          ]}
          placeholder="Confidence"
          allowDeselect={false}
        />

        <Select
          value={riskFilter}
          onChange={(value) => setRiskFilter(value ?? 'all')}
          data={[
            { value: 'all', label: 'All risk' },
            { value: 'low', label: '0-39' },
            { value: 'medium', label: '40-69' },
            { value: 'high', label: '70-100' },
          ]}
          placeholder="Risk"
          allowDeselect={false}
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[1.5fr_1.1fr_120px_120px_150px_180px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Action</span>
          <span>Agent / Task</span>
          <span>Confidence</span>
          <span>Risk</span>
          <span>Assumptions</span>
          <span>Timestamp</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading decisions...
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No decisions match the current filters.
          </div>
        ) : (
          filteredDecisions.map((decision) => (
            <DecisionRow
              key={decision.id}
              decision={decision}
              onOpen={() => setSelectedId(decision.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DecisionRow({ decision, onOpen }: { decision: DecisionRecord; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[1.5fr_1.1fr_120px_120px_150px_180px] gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/40"
    >
      <div>
        <div className="font-medium">{decision.outputAction}</div>
        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {decision.inputContext}
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="font-medium">{decision.agentId}</div>
        <div className="text-muted-foreground">{decision.taskId}</div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <BrainCircuit className="h-4 w-4 text-muted-foreground" />
        <span>{decision.confidenceLevel}%</span>
      </div>
      <div>
        <Badge
          color={riskColor(decision.riskScore)}
          variant="light"
          tt="none"
          leftSection={<ShieldAlert className="h-3 w-3" />}
        >
          {decision.riskScore}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">{decision.assumptions.length}</div>
      <div className="text-sm text-muted-foreground">
        {new Date(decision.timestamp).toLocaleString()}
      </div>
    </button>
  );
}
