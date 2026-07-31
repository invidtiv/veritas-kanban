import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bot, Check, Copy, ExternalLink, KeyRound, RefreshCw, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface AgentCredential {
  agentId: string;
  label: string;
  role: 'agent' | 'read-only';
  keyPrefix: string;
  createdAt: string;
  createdBy: string;
  rotatedAt?: string;
  revokedAt?: string;
}

interface IssuedAgentCredential extends AgentCredential {
  apiKey: string;
}

export function RemoteAgentCredentials() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<AgentCredential[]>([]);
  const [agentId, setAgentId] = useState('');
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<IssuedAgentCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      setCredentials(await apiFetch<AgentCredential[]>('/api/v1/agent-credentials'));
    } catch (error) {
      toast({
        title: 'Could not load remote agents',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const installBase = useMemo(() => window.location.origin, []);

  const createCredential = async () => {
    if (!agentId || saving) return;
    setSaving(true);
    try {
      const result = await apiFetch<IssuedAgentCredential>('/api/v1/agent-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, label: label || undefined, role: 'agent' }),
      });
      setIssued(result);
      setAgentId('');
      setLabel('');
      await loadCredentials();
    } catch (error) {
      toast({
        title: 'Could not create agent identity',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const rotateCredential = async (credential: AgentCredential) => {
    if (!confirm(`Rotate the key for ${credential.agentId}? The current key will stop working.`)) {
      return;
    }
    try {
      const result = await apiFetch<IssuedAgentCredential>(
        `/api/v1/agent-credentials/${encodeURIComponent(credential.agentId)}/rotate`,
        { method: 'POST' }
      );
      setIssued(result);
      await loadCredentials();
    } catch (error) {
      toast({
        title: 'Key rotation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    }
  };

  const revokeCredential = async (credential: AgentCredential) => {
    if (!confirm(`Revoke access for ${credential.agentId}?`)) return;
    try {
      await apiFetch(`/api/v1/agent-credentials/${encodeURIComponent(credential.agentId)}`, {
        method: 'DELETE',
      });
      await loadCredentials();
    } catch (error) {
      toast({
        title: 'Revocation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    }
  };

  const copyKey = async () => {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.apiKey);
    toast({ title: 'Agent key copied', description: 'Paste it only on the target station.' });
  };

  return (
    <section className="space-y-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div>
          <h4 className="font-medium">Remote agent credentials</h4>
          <p className="text-xs text-muted-foreground">
            Create a distinct, revocable identity for each Tailscale-connected coding station.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="remote-agent-id">Agent ID</Label>
          <Input
            id="remote-agent-id"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value.toLowerCase())}
            placeholder="windows-build-01"
            pattern="[a-z0-9][a-z0-9_-]{2,49}"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="remote-agent-label">Label (optional)</Label>
          <Input
            id="remote-agent-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Windows build station 01"
          />
        </div>
        <Button onClick={createCredential} disabled={!agentId || saving}>
          <Bot className="h-4 w-4 mr-2" />
          {saving ? 'Creating…' : 'Create identity'}
        </Button>
      </div>

      {issued && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Check className="h-4 w-4" />
            <strong className="text-sm">Save this key now — it will not be shown again.</strong>
          </div>
          <div className="flex gap-2">
            <Input value={issued.apiKey} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyKey} aria-label="Copy agent key">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Target identity: <code>{issued.agentId}</code>. Transfer the key privately, then dismiss
            it.
          </p>
          <Button variant="outline" size="sm" onClick={() => setIssued(null)}>
            I saved the key
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a
          href="/remote-agent/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Linux and Windows installers <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="/llms.txt"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          llms.txt <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-xs text-muted-foreground">Served from {installBase}</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading agent identities…</p>
        ) : credentials.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No scoped remote identities yet.
          </p>
        ) : (
          credentials.map((credential) => (
            <div
              key={credential.agentId}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{credential.label}</span>
                  <code className="text-xs text-muted-foreground">{credential.agentId}</code>
                  <Badge variant={credential.revokedAt ? 'secondary' : 'default'}>
                    {credential.revokedAt ? 'revoked' : credential.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Key prefix {credential.keyPrefix}… · created{' '}
                  {new Date(credential.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => rotateCredential(credential)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {credential.revokedAt ? 'Re-enable' : 'Rotate'}
                </Button>
                {!credential.revokedAt && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => revokeCredential(credential)}
                  >
                    <ShieldOff className="h-3.5 w-3.5 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
