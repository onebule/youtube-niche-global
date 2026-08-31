export type RpmBenchmarkSourceId = 'vidiq' | 'rpm_meter';

export type RpmBenchmarkSource = {
  id: RpmBenchmarkSourceId;
  name: string;
  url: string;
  role: string;
  note: string;
};

export type RpmBenchmarkRow = {
  sourceId: RpmBenchmarkSourceId;
  sourceName: string;
  sourceUrl: string;
  niche: string;
  lowUsd: number;
  highUsd: number;
  midpointUsd: number;
  capturedAt: string;
  note: string;
};

export type RpmBenchmarkResult = {
  matchedNiche: string | null;
  rows: RpmBenchmarkRow[];
  lowUsd: number | null;
  highUsd: number | null;
  midpointUsd: number | null;
  sourceCount: number;
  confidence: 'UNKNOWN' | 'LOW' | 'MEDIUM';
  status: 'BENCHMARK' | 'UNKNOWN';
  spreadPct: number | null;
};

export const RPM_BENCHMARK_SOURCES: RpmBenchmarkSource[] = [
  {
    id: 'vidiq',
    name: 'vidIQ',
    url: 'https://vidiq.com/blog/post/youtube-rpm/',
    role: '公开赛道区间',
    note: '按赛道给出粗略平均 RPM；受国家、视频长度、广告组合和受众影响。',
  },
  {
    id: 'rpm_meter',
    name: 'RPM Meter',
    url: 'https://rpmmeter.com/rpm-benchmark-sheet/',
    role: '规划基准表',
    note: '编辑部规划区间，不是官方 payout，也不保证频道实际收入。',
  },
];

const SOURCE_BY_ID = Object.fromEntries(RPM_BENCHMARK_SOURCES.map(source => [source.id, source])) as Record<RpmBenchmarkSourceId, RpmBenchmarkSource>;
const CAPTURED_AT = '2026-08';

type BenchmarkSpec = {
  niche: string;
  aliases: string[];
  vidiq: [number, number] | null;
  rpmMeter: [number, number] | null;
};

// Values are transcribed from the two public benchmark tables. They are deliberately
// kept as ranges; no single-point payout is inferred from public metadata.
const BENCHMARK_SPECS: BenchmarkSpec[] = [
  { niche: 'Finance / investing', aliases: ['finance', '金融', '投资', '理财', '股票', 'credit card', '信用卡', 'insurance', '保险', 'tax', '税务'], vidiq: [4, 12], rpmMeter: [8, 30] },
  { niche: 'Business / marketing', aliases: ['business', '商业', 'marketing', '营销', '创业', '生产力', 'productivity', 'b2b'], vidiq: [4, 9], rpmMeter: [6, 26] },
  { niche: 'AI / software', aliases: ['ai', '人工智能', '软件', 'software', 'saas', 'automation', '自动化', 'prompt', '提示词'], vidiq: [4, 10], rpmMeter: [5, 25] },
  { niche: 'Technology', aliases: ['technology', 'tech', '科技', '数码', '开发者', 'developer', '编程', 'gadget'], vidiq: [4, 10], rpmMeter: [4, 18] },
  { niche: 'Education / how-to', aliases: ['education', '教育', '教程', 'how-to', 'how to', '技能', 'career', '职业', '语言学习'], vidiq: [2, 6], rpmMeter: [3, 12] },
  { niche: 'Health / fitness', aliases: ['health', '健康', 'fitness', '健身', 'wellness', '营养'], vidiq: [2, 5], rpmMeter: [4, 16] },
  { niche: 'Food / cooking', aliases: ['food', '食物', '烹饪', '料理', 'cooking', 'recipe', '美食'], vidiq: [2, 5], rpmMeter: null },
  { niche: 'Travel', aliases: ['travel', '旅行', '旅游', '出行'], vidiq: [2, 4], rpmMeter: null },
  { niche: 'Gaming', aliases: ['gaming', '游戏', '电竞', 'esports', 'walkthrough'], vidiq: [2, 4], rpmMeter: [1, 6] },
  { niche: 'Entertainment / vlogs', aliases: ['entertainment', '娱乐', 'comedy', '喜剧', 'vlog', '人物生活', '生活', 'reaction', '评论', '宠物', '动物', 'lifestyle'], vidiq: [1, 2], rpmMeter: [1, 4] },
  { niche: 'Kids / family', aliases: ['kids', '儿童', 'family', '家庭', '亲子'], vidiq: [0.5, 1], rpmMeter: null },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s_·•/|]+/g, ' ');

function makeRow(sourceId: RpmBenchmarkSourceId, niche: string, range: [number, number], note: string): RpmBenchmarkRow {
  const source = SOURCE_BY_ID[sourceId];
  return {
    sourceId,
    sourceName: source.name,
    sourceUrl: source.url,
    niche,
    lowUsd: range[0],
    highUsd: range[1],
    midpointUsd: Number(((range[0] + range[1]) / 2).toFixed(2)),
    capturedAt: CAPTURED_AT,
    note,
  };
}

function median(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function findRpmBenchmarkRows(topic: string | null | undefined): RpmBenchmarkRow[] {
  const value = normalize(String(topic || ''));
  if (!value) return [];
  const spec = BENCHMARK_SPECS.find(candidate => candidate.aliases.some(alias => value.includes(normalize(alias))));
  if (!spec) return [];
  const rows: RpmBenchmarkRow[] = [];
  if (spec.vidiq) rows.push(makeRow('vidiq', spec.niche, spec.vidiq, 'vidIQ 公开赛道平均区间；非频道 Analytics。'));
  if (spec.rpmMeter) rows.push(makeRow('rpm_meter', spec.niche, spec.rpmMeter, 'RPM Meter 编辑部规划区间；非官方 payout。'));
  return rows;
}

export function combineRpmBenchmarks(rows: RpmBenchmarkRow[]): RpmBenchmarkResult {
  const validRows = rows.filter(row => Number.isFinite(row.lowUsd) && Number.isFinite(row.highUsd) && row.lowUsd > 0 && row.highUsd >= row.lowUsd);
  if (!validRows.length) return { matchedNiche: null, rows: [], lowUsd: null, highUsd: null, midpointUsd: null, sourceCount: 0, confidence: 'UNKNOWN', status: 'UNKNOWN', spreadPct: null };
  const midpoint = median(validRows.map(row => row.midpointUsd));
  const lowUsd = Math.min(...validRows.map(row => row.lowUsd));
  const highUsd = Math.max(...validRows.map(row => row.highUsd));
  const rowMidpoints = validRows.map(row => row.midpointUsd);
  const spreadPct = midpoint > 0 ? (Math.max(...rowMidpoints) - Math.min(...rowMidpoints)) / midpoint : null;
  const sourceCount = new Set(validRows.map(row => row.sourceId)).size;
  return {
    matchedNiche: validRows[0].niche,
    rows: validRows,
    lowUsd,
    highUsd,
    midpointUsd: Number(midpoint.toFixed(2)),
    sourceCount,
    confidence: sourceCount >= 2 ? 'MEDIUM' : 'LOW',
    status: 'BENCHMARK',
    spreadPct,
  };
}

export function getRpmBenchmarkForTopic(topic: string | null | undefined): RpmBenchmarkResult {
  const rows = findRpmBenchmarkRows(topic);
  const result = combineRpmBenchmarks(rows);
  if (!result.rows.length) return result;
  return { ...result, matchedNiche: result.matchedNiche || rows[0].niche };
}
