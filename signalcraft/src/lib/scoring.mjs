export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function calculateSignal(snapshot, baseline = {}) {
  const medianViews = baseline.medianViews || 1;
  const ageHours = Math.max(snapshot.ageHours || 1, 1);
  const velocity = snapshot.viewsPerHour ?? snapshot.views / ageHours;
  const relative = snapshot.views / Math.max(snapshot.subscribers || 1, 1);
  const historyRatio = snapshot.views / medianViews;
  const velocityScore = Math.round(clamp(Math.log10(velocity + 1) * 22));
  const outlierScore = Math.round(clamp(Math.log2(historyRatio + 1) * 25 + relative * 4));
  const freshnessScore = Math.round(clamp(100 - ageHours * 0.22));
  const engagementScore = Math.round(clamp(((snapshot.likes + snapshot.comments * 3) / Math.max(snapshot.views, 1)) * 1200));
  const confidence = snapshot.sampleCount >= 4 ? 82 : snapshot.sampleCount >= 2 ? 64 : 42;
  const opportunityScore = Math.round(clamp(velocityScore * 0.30 + outlierScore * 0.32 + freshnessScore * 0.18 + engagementScore * 0.12 + confidence * 0.08));
  return { viewsPerHour: Math.round(velocity), viewsPerSubscriber: Number(relative.toFixed(2)), growthRate: Number((velocity / Math.max(medianViews / 168, 1)).toFixed(2)), velocityScore, outlierScore, confidence, opportunityScore, freshnessScore, engagementScore };
}

export function serializeFilters(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '' && value !== 'all') params.set(key, String(value)); });
  return params.toString();
}

export function parseFilters(search) {
  const p = new URLSearchParams(search);
  return { q: p.get('q') || '', window: p.get('window') || '7d', region: p.get('region') || 'US', language: p.get('language') || 'all', format: p.get('format') || 'all', maxSubs: p.get('maxSubs') || '100000', minScore: p.get('minScore') || '70', sort: p.get('sort') || 'score' };
}
