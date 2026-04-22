/**
 * Agent assignment helpers for multi-agent task support.
 *
 * Provides backward-compatible handling of the agent/agents fields:
 * - Single `agent` field: original behavior, one assignee
 * - Array `agents` field: multi-agent assignment
 * - Both populated: `agents` takes precedence
 * - `agent` auto-populated from first entry in `agents` for backward compat
 */

import type { AgentType, Task } from '../types/task.types.js';

export interface AgentReference {
  type: string;
  name: string;
}

function normalizeAgentReference(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve an agent reference against a catalog of known agents.
 * Matches by canonical type first, then by display name.
 */
export function findAgentReference<T extends AgentReference>(
  agents: T[],
  ref: string | undefined
): T | undefined {
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
  });
}

/**
 * Convert an agent reference to the canonical agent type when possible.
 */
export function canonicalizeAgentReference<T extends AgentReference>(
  agents: T[],
  ref: string | undefined
): string | undefined {
  return findAgentReference(agents, ref)?.type;
}

/**
 * Format an agent reference using the catalog display name.
 */
export function formatAgentReference<T extends AgentReference>(
  agents: T[],
  ref: string | undefined
): string | undefined {
  return findAgentReference(agents, ref)?.name;
}

/**
 * Get all assigned agents for a task.
 * Returns agents array if present, falls back to wrapping single agent.
 */
export function getAssignedAgents(task: Pick<Task, 'agent' | 'agents'>): AgentType[] {
  if (task.agents && task.agents.length > 0) {
    return task.agents;
  }
  if (task.agent && task.agent !== 'auto') {
    return [task.agent];
  }
  return [];
}

/**
 * Get the primary agent (first assigned).
 */
export function getPrimaryAgent(task: Pick<Task, 'agent' | 'agents'>): AgentType | undefined {
  const agents = getAssignedAgents(task);
  return agents[0];
}

/**
 * Check if a specific agent is assigned to a task.
 */
export function isAgentAssigned(task: Pick<Task, 'agent' | 'agents'>, agentId: string): boolean {
  return getAssignedAgents(task).some((a) => a.toLowerCase() === agentId.toLowerCase());
}

/**
 * Normalize agent fields on a task input.
 * Ensures `agents` and `agent` are consistent.
 */
export function normalizeAgentFields<
  T extends { agent?: AgentType | 'auto'; agents?: AgentType[] },
>(input: T): T {
  const result = { ...input };

  if (result.agents && result.agents.length > 0) {
    // Set primary agent from agents array for backward compat
    result.agent = result.agents[0];
  } else if (result.agent && result.agent !== 'auto') {
    // Wrap single agent in array
    result.agents = [result.agent];
  }

  return result;
}
