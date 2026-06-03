import { ArrowLeft, CheckCircle2, ShieldAlert, Route, FileJson } from 'lucide-react';
import { Badge, Button, Code, ScrollArea } from '@mantine/core';
import { useGovernanceTrace } from '@/hooks/useGovernanceTraces';
import type {
  GovernanceTraceRecord,
  GovernanceTraceRule,
  GovernanceTraceStep,
} from '@veritas-kanban/shared';

interface GovernanceTraceDetailProps {
  traceId: string;
  onBack: () => void;
}

const outcomeColor: Record<GovernanceTraceRecord['outcome'], string> = {
  allowed: 'green',
  warned: 'yellow',
  blocked: 'red',
  'approval-required': 'orange',
  routed: 'blue',
  fallback: 'yellow',
  skipped: 'gray',
};

const statusColor: Record<GovernanceTraceRule['status'], string> = {
  matched: 'green',
  'not-matched': 'gray',
  skipped: 'gray',
  info: 'blue',
};

export function GovernanceTraceDetail({ traceId, onBack }: GovernanceTraceDetailProps) {
  const { data: trace, isLoading } = useGovernanceTrace(traceId);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Loading governance trace...
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Governance trace not found.
      </div>
    );
  }

  const subjectEntries = Object.entries(trace.subject).filter(
    ([, value]) => value !== undefined && value !== ''
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="subtle" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Traces
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="blue" variant="light" tt="none">
            {trace.kind}
          </Badge>
          <Badge color={outcomeColor[trace.outcome]} variant="light" tt="none">
            {trace.outcome}
          </Badge>
          {trace.redacted && (
            <Badge color="gray" variant="outline" tt="none">
              redacted
            </Badge>
          )}
        </div>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border bg-muted/50 p-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{trace.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{trace.summary}</p>
            {trace.remediation && (
              <div className="mt-4 rounded-md border border-dashed p-3 text-sm">
                <div className="font-medium">Remediation</div>
                <p className="mt-1 text-muted-foreground">{trace.remediation}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Subject</h2>
          </div>
          {subjectEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subject metadata recorded.</p>
          ) : (
            <div className="space-y-2">
              {subjectEntries.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="max-w-[65%] break-words text-right font-medium">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 text-xs text-muted-foreground">
            {new Date(trace.createdAt).toLocaleString()}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Evaluated Rules</h2>
            <Badge variant="light" tt="none">
              {trace.matchedRules.length} matched
            </Badge>
          </div>
          <div className="space-y-3">
            {trace.evaluatedRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rules evaluated.</p>
            ) : (
              trace.evaluatedRules.map((rule) => <RuleRow key={rule.id} rule={rule} />)
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Trace Steps</h2>
        <div className="mt-4 space-y-3">
          {trace.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps recorded.</p>
          ) : (
            trace.steps.map((step) => <StepRow key={step.id} step={step} />)
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileJson className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Raw Detail</h2>
        </div>
        <ScrollArea h={280} type="auto">
          <Code block className="text-xs">
            {JSON.stringify(trace.raw ?? trace, null, 2)}
          </Code>
        </ScrollArea>
      </section>
    </div>
  );
}

function RuleRow({ rule }: { rule: GovernanceTraceRule }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{rule.label}</span>
        <Badge color={statusColor[rule.status]} variant="light" tt="none">
          {rule.status}
        </Badge>
        {rule.outcome && (
          <Badge color={outcomeColor[rule.outcome]} variant="outline" tt="none">
            {rule.outcome}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{rule.message}</p>
      {rule.details && (
        <Code block className="mt-3 text-xs">
          {JSON.stringify(rule.details, null, 2)}
        </Code>
      )}
    </div>
  );
}

function StepRow({ step }: { step: GovernanceTraceStep }) {
  return (
    <div className="flex gap-3 rounded-md border p-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{step.label}</span>
          <Badge color={statusColor[step.status]} variant="light" tt="none">
            {step.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.message}</p>
        {step.details && (
          <Code block className="mt-3 text-xs">
            {JSON.stringify(step.details, null, 2)}
          </Code>
        )}
      </div>
    </div>
  );
}
