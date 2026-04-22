type AgentReference = {
  type: string;
  name: string;
};
import { ConfigService } from '../services/config-service.js';
import { getAgentRegistryService } from '../services/agent-registry-service.js';

const configService = new ConfigService();
const AGENT_REF_REGEX = /^[a-zA-Z0-9._: -]{1,100}$/;
const RESERVED_ACTORS = new Set(['admin', 'localhost-bypass', 'session', 'unknown']);

function normalizeAgentReference(value: string): string {
  return value.trim().toLowerCase();
}

function canonicalizeAgentReference(
  agents: AgentReference[],
  ref: string | undefined
): string | undefined {
  if (!ref) {
    return undefined;
  }

  const normalizedRef = normalizeAgentReference(ref);
  if (!normalizedRef) {
    return undefined;
  }

  return agents.find((agent) => {
    const normalizedType = normalizeAgentReference(agent.type);
    const normalizedName = normalizeAgentReference(agent.name);
    return normalizedType === normalizedRef || normalizedName === normalizedRef;
  })?.type;
}

function dedupeAgentCatalog(entries: AgentReference[]): AgentReference[] {
  const catalog = new Map<string, AgentReference>();

  for (const entry of entries) {
    const normalizedType = entry.type.trim().toLowerCase();
    if (!normalizedType || catalog.has(normalizedType)) {
      continue;
    }

    catalog.set(normalizedType, {
      type: entry.type.trim(),
      name: entry.name.trim() || entry.type.trim(),
    });
  }

  return Array.from(catalog.values());
}

async function getKnownAgents(
  source: Pick<ConfigService, 'getConfig'> = configService
): Promise<AgentReference[]> {
  const config = await source.getConfig();
  const configuredAgents = config.agents.map((agent) => ({
    type: agent.type,
    name: agent.name,
  }));
  const registeredAgents = getAgentRegistryService()
    .list()
    .map((agent) => ({
      type: agent.id,
      name: agent.name,
    }));

  return dedupeAgentCatalog([...configuredAgents, ...registeredAgents]);
}

export async function resolveCanonicalActorRef(
  actor: string | undefined,
  source: Pick<ConfigService, 'getConfig'> = configService
): Promise<string | undefined> {
  if (!actor) {
    return undefined;
  }

  const trimmedActor = actor.trim();
  if (!trimmedActor) {
    return undefined;
  }

  if (RESERVED_ACTORS.has(trimmedActor)) {
    return trimmedActor;
  }

  const canonical = canonicalizeAgentReference(await getKnownAgents(source), trimmedActor);
  return canonical || trimmedActor;
}

export async function validateAssignableAgentRef(
  agentRef: string | undefined,
  source: Pick<ConfigService, 'getConfig'> = configService
): Promise<{ valid: boolean; canonicalRef?: string; reason?: string }> {
  if (!agentRef || agentRef === 'auto') {
    return { valid: true };
  }

  const trimmedRef = agentRef.trim();
  if (!trimmedRef) {
    return { valid: true };
  }

  if (!AGENT_REF_REGEX.test(trimmedRef)) {
    return { valid: false, reason: `Malformed agent ref: ${agentRef}` };
  }

  const canonical = canonicalizeAgentReference(await getKnownAgents(source), trimmedRef);
  if (canonical) {
    return { valid: true, canonicalRef: canonical };
  }

  return {
    valid: false,
    reason: `Unknown agent ref: ${agentRef} — not found in configured agents or registry`,
  };
}
