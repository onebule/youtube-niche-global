/**
 * URL state shared by the research desk surfaces.
 *
 * These helpers only describe view state (filters, lane and focused item). They
 * never encode scores or user workspace data, so a copied URL is safe to
 * replay and does not cross account boundaries.
 */
export type ResearchUrlState = {
  market?: string;
  window?: string;
  lane?: string;
  topic?: string;
  direction?: string;
};

const clean = (value: string | null) => value && value.trim() ? value.trim() : undefined;

export function readResearchUrlState(search: string): ResearchUrlState {
  const params = new URLSearchParams(search);
  return {
    market: clean(params.get('market')),
    window: clean(params.get('window')),
    lane: clean(params.get('lane')),
    topic: clean(params.get('topic')) || clean(params.get('nicheName')),
    direction: clean(params.get('direction')),
  };
}

export function writeResearchUrlState(search: string, patch: Partial<ResearchUrlState>) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    else if (value === null || value === undefined || value === '') params.delete(key);
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}
