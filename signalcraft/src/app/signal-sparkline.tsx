type SignalSparklineProps = {
  points: Array<number | null>;
  label: string;
  tone?: 'teal' | 'coral' | 'gold';
};

const finitePoints = (points: Array<number | null>) => points.filter((point): point is number => typeof point === 'number' && Number.isFinite(point));

export default function SignalSparkline({ points, label, tone = 'teal' }: SignalSparklineProps) {
  const safe = finitePoints(points);
  if (safe.length < 2) return <span className="signal-sparkline signal-sparkline-empty" aria-label={`${label}: unavailable`}>—</span>;
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = max - min || 1;
  const width = 92;
  const height = 28;
  const coordinates = points.map((point, index) => {
    if (typeof point !== 'number' || !Number.isFinite(point)) return null;
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point - min) / span) * (height - 5) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(' ');
  return <span className={`signal-sparkline ${tone}`} role="img" aria-label={label}>
    <svg viewBox={`0 0 ${width} ${height}`} focusable="false" aria-hidden="true">
      <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>;
}
