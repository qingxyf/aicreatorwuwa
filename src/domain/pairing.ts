import type { WorkEntry } from '../types/activity';

type PairingCandidate = Pick<WorkEntry, 'id' | 'exposureCount' | 'status'> & { createdAt?: string };

export function selectBalancedPair(entries: PairingCandidate[], seenWorkIds: Set<string>): [string, string] | null {
  const eligible = [...entries]
    .filter((entry) => entry.status === 'approved' && !seenWorkIds.has(entry.id))
    .sort((left, right) => left.exposureCount - right.exposureCount || (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));

  if (eligible.length < 2) return null;
  return [eligible[0].id, eligible[1].id];
}
