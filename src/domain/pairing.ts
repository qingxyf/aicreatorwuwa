import type { WorkEntry } from '../types/activity';

export function selectBalancedPair(entries: WorkEntry[], seenWorkIds: Set<string>): [string, string] | null {
  const eligible = entries
    .filter((entry) => entry.status === 'approved' && !seenWorkIds.has(entry.id))
    .toSorted((left, right) => left.exposureCount - right.exposureCount || left.createdAt.localeCompare(right.createdAt));

  if (eligible.length < 2) return null;
  return [eligible[0].id, eligible[1].id];
}
