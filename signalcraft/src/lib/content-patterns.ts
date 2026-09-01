/**
 * P2 Phase 1 — Long-form content intelligence and winning-pattern detection.
 *
 * This module is deliberately independent from the Shorts case/pattern library
 * (`viral-patterns.ts`). It only promotes deterministic, public metadata
 * features to candidates. A pattern becomes WINNING only after cross-video and
 * cross-creator evidence gates pass; raw views and one viral outlier never win.
 */

export const CONTENT_PATTERN_ALGORITHM_VERSION = 'content-patterns-v1';

export const CONTENT_PATTERN_CONFIG = Object.freeze({
  minEligibleVideos: 5,
  minEligibleCreators: 3,
  minWinningBreakoutVideos: 3,
  minWinningBreakoutCreators: 2,
  minWinningPerformanceSamples: 3,
  winningMedianPerformance: 1.1,
  highConfidenceMinVideos: 20,
  highConfidenceMinCreators: 8,
  lowConfidenceMissingPerformanceShare: 0.6,
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type ContentFieldStatus =
  | 'AVAILABLE'
  | 'DERIVABLE'
  | 'PARTIAL'
  | 'REQUIRES_LLM'
  | 'REQUIRES_VISION'
  | 'REQUIRES_NEW_DATA'
  | 'UNAVAILABLE';

export type ContentFieldName =
  | 'videoTitle'
  | 'description'
  | 'duration'
  | 'publishDate'
  | 'channelId'
  | 'nicheId'
  | 'views'
  | 'normalizedPerformance'
  | 'creatorBaseline'
  | 'breakoutClassification'
  | 'thumbnailUrl'
  | 'transcript'
  | 'subtitles'
  | 'videoTags'
  | 'chapters'
  | 'semanticEmbeddings'
  | 'topicClassification'
  | 'formatClassification'
  | 'hookText'
  | 'storyStructure'
  | 'editingStyle'
  | 'productionMethod'
  | 'visualFeatures'
  | 'audioFeatures';

export type ContentFieldAudit = {
  status: ContentFieldStatus;
  presentCount: number;
  sampleCount: number;
  provenance: string;
  note: string;
};

export type ContentDataAvailability = {
  scope: 'LONG_FORM';
  coverage: number;
  availableFields: number;
  unavailableFields: number;
  fields: Record<ContentFieldName, ContentFieldAudit>;
};

export type ContentPatternVideo = {
  videoId: string;
  creatorId: string;
  format: 'long' | 'short' | string | null;
  title?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  publishedAt?: string | null;
  channelId?: string | null;
  nicheId?: string | null;
  topic?: string | null;
  views?: number | null;
  normalizedPerformance?: number | null;
  baselineStatus?: 'VERIFIED' | 'INSUFFICIENT' | 'UNAVAILABLE' | string | null;
  baselineConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' | string | null;
  breakoutClassification?: string | null;
  breakoutMultiple?: number | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  transcript?: string | null;
  subtitles?: string[] | null;
  videoTags?: string[] | null;
  chapters?: unknown[] | null;
  semanticEmbeddings?: number[] | null;
  hookText?: string | null;
  storyStructure?: string | null;
  editingStyle?: string | null;
  productionMethod?: string | null;
  visualFeatures?: string[] | null;
  audioFeatures?: string[] | null;
};

export type ContentPatternTaxonomy = 'TITLE_STRUCTURE' | 'TITLE_SIGNAL' | 'DURATION_BAND';

export type ContentPattern = {
  patternId: string;
  taxonomy: ContentPatternTaxonomy;
  featureKey: string;
  featureValue: string;
  label: string;
  derivation: 'DETERMINISTIC_METADATA';
};

export type PatternEvidence = {
  eligibleVideoIds: string[];
  creatorIds: string[];
  performanceVideoIds: string[];
  breakoutVideoIds: string[];
  breakoutCreatorIds: string[];
  observedFields: string[];
  missingFields: string[];
};

export type PatternCandidate = {
  pattern: ContentPattern;
  sourceVideoId: string;
  creatorId: string;
  evidence: PatternEvidence;
};

export type PatternPerformance = {
  sampleSize: number;
  normalizedPerformanceCount: number;
  medianNormalizedPerformance: number | null;
  p75NormalizedPerformance: number | null;
  unit: 'CREATOR_BASELINE_MULTIPLE' | null;
  rawViewsUsed: false;
};

export type PatternRepeatabilityStatus = 'INSUFFICIENT' | 'ONE_CREATOR' | 'MULTI_CREATOR_ONE_OFF' | 'REPEATED_ACROSS_CREATORS';

export type PatternRepeatability = {
  eligibleVideos: number;
  successfulVideos: number;
  distinctCreators: number;
  successfulCreators: number;
  repeatedAcrossVideos: boolean;
  repeatedAcrossCreators: boolean;
  status: PatternRepeatabilityStatus;
};

export type CrossCreatorPatternEvidence = {
  distinctCreators: number;
  creatorsWithBreakout: number;
  creatorIds: string[];
  breakoutCreatorIds: string[];
  status: 'INSUFFICIENT' | 'ONE_CREATOR' | 'MULTIPLE_CREATORS' | 'REPEATED_ACROSS_CREATORS';
};

export type PatternConfidence = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';

export type WinningPatternStatus = 'WINNING' | 'CANDIDATE' | 'INSUFFICIENT';

export type WinningPattern = {
  pattern: ContentPattern;
  status: WinningPatternStatus;
  confidence: PatternConfidence;
  reasonCodes: string[];
  evidence: {
    eligibleVideos: number;
    creators: number;
    breakoutVideos: number;
    breakoutCreators: number;
    normalizedPerformanceSamples: number;
  };
};

export type PatternAggregation = {
  pattern: ContentPattern;
  frequency: { occurrences: number; eligibleVideos: number; share: number | null };
  creatorBreadth: { distinctCreators: number; shareOfCreators: number | null };
  performance: PatternPerformance;
  breakoutEvidence: { assessableVideos: number; breakoutVideos: number; breakoutRate: number | null; breakoutCreators: number };
  crossCreatorEvidence: CrossCreatorPatternEvidence;
  repeatability: PatternRepeatability;
  confidence: PatternConfidence;
  winningPattern: WinningPattern;
  provenance: {
    algorithmVersion: string;
    source: 'PUBLIC_YOUTUBE_METADATA';
    capturedAt: string | null;
    snapshotId: string | null;
    inputVideoIds: string[];
    supportedFields: string[];
    unavailableFields: string[];
    calibrationStatus: typeof CONTENT_PATTERN_CONFIG.calibrationStatus;
  };
};

export type ContentPatternReport = {
  schemaVersion: 'content-patterns.v1';
  algorithmVersion: typeof CONTENT_PATTERN_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  dataAvailability: ContentDataAvailability;
  input: { receivedVideos: number; longFormVideos: number; excludedShorts: number; uniqueCreators: number };
  candidates: PatternCandidate[];
  aggregations: PatternAggregation[];
  winningPatterns: WinningPattern[];
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA'; capturedAt: string | null; snapshotId: string | null; calibrationStatus: typeof CONTENT_PATTERN_CONFIG.calibrationStatus };
};

const FIELD_NAMES: readonly ContentFieldName[] = [
  'videoTitle', 'description', 'duration', 'publishDate', 'channelId', 'nicheId', 'views', 'normalizedPerformance', 'creatorBaseline', 'breakoutClassification', 'thumbnailUrl', 'transcript', 'subtitles', 'videoTags', 'chapters', 'semanticEmbeddings', 'topicClassification', 'formatClassification', 'hookText', 'storyStructure', 'editingStyle', 'productionMethod', 'visualFeatures', 'audioFeatures',
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const sortStrings = (values: Iterable<string>) => [...new Set([...values].filter(nonEmpty))].sort((a, b) => a.localeCompare(b));

function stableHash(value: string) {
  // FNV-1a is small, deterministic and available in browser/server runtimes.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function stableContentPatternId(taxonomy: ContentPatternTaxonomy, featureKey: string, featureValue: string) {
  const canonical = [taxonomy, featureKey.trim().toLowerCase(), featureValue.trim().toLowerCase()].join('|');
  return `content-pattern-v1:${stableHash(canonical)}`;
}

function valueForField(video: ContentPatternVideo, field: ContentFieldName): unknown {
  const values: Record<ContentFieldName, unknown> = {
    videoTitle: video.title,
    description: video.description,
    duration: video.durationSeconds,
    publishDate: video.publishedAt,
    channelId: video.channelId || video.creatorId,
    nicheId: video.nicheId,
    views: video.views,
    normalizedPerformance: video.normalizedPerformance,
    creatorBaseline: video.baselineStatus === 'VERIFIED' ? video.baselineStatus : null,
    breakoutClassification: video.breakoutClassification,
    thumbnailUrl: video.thumbnailUrl,
    transcript: video.transcript,
    subtitles: video.subtitles,
    videoTags: video.videoTags,
    chapters: video.chapters,
    semanticEmbeddings: video.semanticEmbeddings,
    topicClassification: video.topic,
    formatClassification: video.format,
    hookText: video.hookText,
    storyStructure: video.storyStructure,
    editingStyle: video.editingStyle,
    productionMethod: video.productionMethod,
    visualFeatures: video.visualFeatures,
    audioFeatures: video.audioFeatures,
  };
  return values[field];
}

function baseFieldStatus(field: ContentFieldName): { status: ContentFieldStatus; provenance: string; note: string } {
  if (['transcript', 'subtitles', 'videoTags', 'chapters', 'semanticEmbeddings'].includes(field)) return { status: 'REQUIRES_NEW_DATA', provenance: 'not present in the Long-form public response contract', note: '需要新增采集字段或服务；当前不补齐。' };
  if (['hookText', 'storyStructure', 'editingStyle', 'productionMethod'].includes(field)) return { status: 'REQUIRES_LLM', provenance: 'not derivable from the current metadata-only contract', note: '需要经过批准的文本/多模态分析；当前不推断。' };
  if (field === 'visualFeatures') return { status: 'REQUIRES_VISION', provenance: 'thumbnail alone is not video visual evidence', note: '缩略图不能代表完整视频视觉特征。' };
  if (field === 'audioFeatures') return { status: 'REQUIRES_NEW_DATA', provenance: 'audio stream is not present in the public response contract', note: '需要音轨或字幕数据；当前不推断。' };
  if (field === 'formatClassification') return { status: 'DERIVABLE', provenance: 'explicit format or duration gate', note: 'Long-form 只接受显式 long 格式；不把 Shorts 混入。' };
  if (field === 'topicClassification') return { status: 'DERIVABLE', provenance: 'niche/topic metadata when supplied', note: '没有主题字段时保持未知。' };
  return { status: 'AVAILABLE', provenance: 'public YouTube metadata or saved creator evidence when supplied', note: '只统计实际传入的字段。' };
}

export function buildContentDataAvailability(videos: readonly ContentPatternVideo[]): ContentDataAvailability {
  const sampleCount = videos.length;
  const fields = Object.fromEntries(FIELD_NAMES.map(field => {
    const presentCount = videos.filter(video => {
      const value = valueForField(video, field);
      return Array.isArray(value) ? value.length > 0 : finite(value) || nonEmpty(value);
    }).length;
    const base = baseFieldStatus(field);
    const status: ContentFieldStatus = base.status === 'AVAILABLE' && presentCount === 0
      ? 'UNAVAILABLE'
      : base.status === 'AVAILABLE' && presentCount < sampleCount
        ? 'PARTIAL'
        : base.status === 'DERIVABLE' && presentCount === 0
          ? 'DERIVABLE'
          : base.status;
    return [field, { status, presentCount, sampleCount, provenance: base.provenance, note: base.note } satisfies ContentFieldAudit];
  })) as Record<ContentFieldName, ContentFieldAudit>;
  const availableStatuses = new Set<ContentFieldStatus>(['AVAILABLE', 'DERIVABLE', 'PARTIAL']);
  const availableFields = Object.values(fields).filter(field => availableStatuses.has(field.status)).length;
  return { scope: 'LONG_FORM', coverage: FIELD_NAMES.length ? round((availableFields / FIELD_NAMES.length) * 100, 1) : 0, availableFields, unavailableFields: FIELD_NAMES.length - availableFields, fields };
}

function normalizedTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function titleStructure(title: string) {
  const value = normalizedTitle(title);
  if (/\bhow\s+to\b|\bmake(?:ing)?\b|教程|指南|方法/.test(value)) return 'HOW_TO';
  if (/\b(?:why|what|who|is|can|does)\b|[?？]/.test(value)) return 'QUESTION';
  if (/\b(?:top|best|worst|\d{1,2})\b|十|五|三/.test(value)) return 'LIST_OR_NUMBER';
  if (/\b(?:vs\.?|versus|compared?\s+to|对比|比较)\b/.test(value)) return 'COMPARISON';
  if (/\b(?:story|journey|documentary|explained|纪录|故事|实录)\b/.test(value)) return 'STORY';
  return 'PLAIN';
}

function durationBand(durationSeconds: number) {
  if (durationSeconds < 600) return 'UNDER_10_MIN';
  if (durationSeconds < 1800) return '10_TO_30_MIN';
  return 'OVER_30_MIN';
}

function pattern(taxonomy: ContentPatternTaxonomy, featureKey: string, featureValue: string, label = featureValue): ContentPattern {
  return { patternId: stableContentPatternId(taxonomy, featureKey, featureValue), taxonomy, featureKey, featureValue, label, derivation: 'DETERMINISTIC_METADATA' };
}

function candidatesForVideo(video: ContentPatternVideo): PatternCandidate[] {
  if (video.format !== 'long' || !video.videoId || !video.creatorId) return [];
  const candidates: ContentPattern[] = [];
  if (nonEmpty(video.title)) {
    const structure = titleStructure(video.title);
    candidates.push(pattern('TITLE_STRUCTURE', 'titleStructure', structure, `标题结构 · ${structure}`));
    const title = normalizedTitle(video.title);
    if (/[?？]/.test(video.title)) candidates.push(pattern('TITLE_SIGNAL', 'hasQuestion', 'true', '标题含问题'));
    if (/\d/.test(title)) candidates.push(pattern('TITLE_SIGNAL', 'hasNumber', 'true', '标题含数字'));
    if (/\bhow\s+to\b|教程|指南|方法/.test(title)) candidates.push(pattern('TITLE_SIGNAL', 'hasInstruction', 'true', '标题含教程意图'));
    if (/\b(?:vs\.?|versus|对比|比较)\b/.test(title)) candidates.push(pattern('TITLE_SIGNAL', 'hasComparison', 'true', '标题含对比意图'));
  }
  if (finite(video.durationSeconds) && video.durationSeconds >= 0) {
    const band = durationBand(video.durationSeconds);
    candidates.push(pattern('DURATION_BAND', 'durationBand', band, `时长带 · ${band}`));
  }
  const evidence: PatternEvidence = {
    eligibleVideoIds: [video.videoId], creatorIds: [video.creatorId], performanceVideoIds: finite(video.normalizedPerformance) ? [video.videoId] : [],
    breakoutVideoIds: isValidBreakout(video) ? [video.videoId] : [], breakoutCreatorIds: isValidBreakout(video) ? [video.creatorId] : [],
    observedFields: ['videoId', 'creatorId', 'format', ...(nonEmpty(video.title) ? ['title'] : []), ...(finite(video.durationSeconds) ? ['duration'] : []), ...(finite(video.normalizedPerformance) ? ['normalizedPerformance'] : []), ...(isValidBreakout(video) ? ['breakoutClassification'] : [])],
    missingFields: ['transcript', 'subtitles', 'videoTags', 'chapters', 'hookText', 'storyStructure', 'editingStyle', 'productionMethod', 'visualFeatures', 'audioFeatures'],
  };
  return candidates.map(item => ({ pattern: item, sourceVideoId: video.videoId, creatorId: video.creatorId, evidence }));
}

function isValidBreakout(video: ContentPatternVideo) {
  return isBreakoutAssessable(video) && ['BREAKOUT', 'STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(video.breakoutClassification!);
}

function isBreakoutAssessable(video: ContentPatternVideo) {
  return nonEmpty(video.breakoutClassification) && video.breakoutClassification !== 'INSUFFICIENT' && finite(video.breakoutMultiple) && video.breakoutMultiple >= 0;
}

function uniqueLongFormVideos(videos: readonly ContentPatternVideo[]) {
  const byId = new Map<string, ContentPatternVideo>();
  for (const video of videos) {
    if (!video || video.format !== 'long' || !nonEmpty(video.videoId) || !nonEmpty(video.creatorId)) continue;
    const existing = byId.get(video.videoId);
    if (!existing || canonicalVideoSignature(video) < canonicalVideoSignature(existing)) byId.set(video.videoId, video);
  }
  return [...byId.values()].sort((a, b) => a.videoId.localeCompare(b.videoId));
}

function canonicalVideoSignature(video: ContentPatternVideo) {
  return JSON.stringify(Object.entries(video).sort(([left], [right]) => left.localeCompare(right)));
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: readonly number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function confidenceFor(input: { videos: number; creators: number; performanceSamples: number }) : PatternConfidence {
  if (input.videos < CONTENT_PATTERN_CONFIG.minEligibleVideos || input.creators < CONTENT_PATTERN_CONFIG.minEligibleCreators) return 'INSUFFICIENT';
  if (input.performanceSamples / Math.max(1, input.videos) < 1 - CONTENT_PATTERN_CONFIG.lowConfidenceMissingPerformanceShare) return 'LOW';
  if (input.videos >= CONTENT_PATTERN_CONFIG.highConfidenceMinVideos && input.creators >= CONTENT_PATTERN_CONFIG.highConfidenceMinCreators) return 'HIGH';
  return 'MEDIUM';
}

function buildAggregation(patternValue: ContentPattern, videos: readonly ContentPatternVideo[], allVideoCount: number, allCreatorCount: number, capturedAt: string | null, snapshotId: string | null): PatternAggregation {
  const videoIds = videos.map(video => video.videoId).sort();
  const creatorIds = sortStrings(videos.map(video => video.creatorId));
  const performanceVideos = videos.filter(video => finite(video.normalizedPerformance));
  const performanceValues = performanceVideos.map(video => video.normalizedPerformance!).filter(value => value >= 0);
  const breakoutVideos = videos.filter(isValidBreakout);
  const breakoutCreatorIds = sortStrings(breakoutVideos.map(video => video.creatorId));
  const confidence = confidenceFor({ videos: videos.length, creators: creatorIds.length, performanceSamples: performanceValues.length });
  const successfulVideos = performanceVideos.filter(video => video.normalizedPerformance! >= CONTENT_PATTERN_CONFIG.winningMedianPerformance);
  const successfulCreatorIds = sortStrings(successfulVideos.map(video => video.creatorId));
  const repeatabilityStatus: PatternRepeatabilityStatus = videos.length < CONTENT_PATTERN_CONFIG.minEligibleVideos || creatorIds.length < CONTENT_PATTERN_CONFIG.minEligibleCreators
    ? 'INSUFFICIENT'
    : creatorIds.length === 1 ? 'ONE_CREATOR'
      : breakoutCreatorIds.length >= CONTENT_PATTERN_CONFIG.minWinningBreakoutCreators && successfulCreatorIds.length >= 2 ? 'REPEATED_ACROSS_CREATORS'
        : 'MULTI_CREATOR_ONE_OFF';
  const crossCreatorStatus: CrossCreatorPatternEvidence['status'] = creatorIds.length < CONTENT_PATTERN_CONFIG.minEligibleCreators
    ? 'INSUFFICIENT' : breakoutCreatorIds.length >= CONTENT_PATTERN_CONFIG.minWinningBreakoutCreators ? 'REPEATED_ACROSS_CREATORS' : creatorIds.length === 1 ? 'ONE_CREATOR' : 'MULTIPLE_CREATORS';
  const winning = videos.length >= CONTENT_PATTERN_CONFIG.minEligibleVideos
    && creatorIds.length >= CONTENT_PATTERN_CONFIG.minEligibleCreators
    && breakoutVideos.length >= CONTENT_PATTERN_CONFIG.minWinningBreakoutVideos
    && breakoutCreatorIds.length >= CONTENT_PATTERN_CONFIG.minWinningBreakoutCreators
    && performanceValues.length >= CONTENT_PATTERN_CONFIG.minWinningPerformanceSamples
    && (median(performanceValues) || 0) >= CONTENT_PATTERN_CONFIG.winningMedianPerformance;
  const reasonCodes = [
    videos.length < CONTENT_PATTERN_CONFIG.minEligibleVideos ? 'INSUFFICIENT_VIDEO_SAMPLE' : 'VIDEO_SAMPLE_OK',
    creatorIds.length < CONTENT_PATTERN_CONFIG.minEligibleCreators ? 'INSUFFICIENT_CREATOR_BREADTH' : 'CREATOR_BREADTH_OK',
    performanceValues.length < CONTENT_PATTERN_CONFIG.minWinningPerformanceSamples ? 'INSUFFICIENT_NORMALIZED_PERFORMANCE' : 'NORMALIZED_PERFORMANCE_OBSERVED',
    breakoutCreatorIds.length < CONTENT_PATTERN_CONFIG.minWinningBreakoutCreators ? 'INSUFFICIENT_CROSS_CREATOR_BREAKOUT' : 'CROSS_CREATOR_BREAKOUT_OBSERVED',
    repeatabilityStatus === 'REPEATED_ACROSS_CREATORS' ? 'REPEATABILITY_OBSERVED' : 'REPEATABILITY_NOT_CONFIRMED',
  ];
  const status: WinningPatternStatus = winning ? 'WINNING' : confidence === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'CANDIDATE';
  const missing = ['transcript', 'subtitles', 'videoTags', 'chapters', 'semanticEmbeddings', 'hookText', 'storyStructure', 'editingStyle', 'productionMethod', 'visualFeatures', 'audioFeatures'];
  return {
    pattern: patternValue,
    frequency: { occurrences: videos.length, eligibleVideos: videos.length, share: allVideoCount ? round(videos.length / allVideoCount) : null },
    creatorBreadth: { distinctCreators: creatorIds.length, shareOfCreators: allCreatorCount ? round(creatorIds.length / allCreatorCount) : null },
    performance: { sampleSize: videos.length, normalizedPerformanceCount: performanceValues.length, medianNormalizedPerformance: median(performanceValues) === null ? null : round(median(performanceValues)!), p75NormalizedPerformance: percentile(performanceValues, .75) === null ? null : round(percentile(performanceValues, .75)!), unit: performanceValues.length ? 'CREATOR_BASELINE_MULTIPLE' : null, rawViewsUsed: false },
    breakoutEvidence: { assessableVideos: videos.filter(isBreakoutAssessable).length, breakoutVideos: breakoutVideos.length, breakoutRate: videos.filter(isBreakoutAssessable).length ? round(breakoutVideos.length / videos.filter(isBreakoutAssessable).length) : null, breakoutCreators: breakoutCreatorIds.length },
    crossCreatorEvidence: { distinctCreators: creatorIds.length, creatorsWithBreakout: breakoutCreatorIds.length, creatorIds, breakoutCreatorIds, status: crossCreatorStatus },
    repeatability: { eligibleVideos: videos.length, successfulVideos: successfulVideos.length, distinctCreators: creatorIds.length, successfulCreators: successfulCreatorIds.length, repeatedAcrossVideos: successfulVideos.length >= 2, repeatedAcrossCreators: repeatabilityStatus === 'REPEATED_ACROSS_CREATORS', status: repeatabilityStatus },
    confidence,
    winningPattern: { pattern: patternValue, status, confidence, reasonCodes, evidence: { eligibleVideos: videos.length, creators: creatorIds.length, breakoutVideos: breakoutVideos.length, breakoutCreators: breakoutCreatorIds.length, normalizedPerformanceSamples: performanceValues.length } },
    provenance: { algorithmVersion: CONTENT_PATTERN_ALGORITHM_VERSION, source: 'PUBLIC_YOUTUBE_METADATA', capturedAt, snapshotId, inputVideoIds: videoIds, supportedFields: ['videoTitle', 'duration', 'channelId', 'nicheId', 'views', 'normalizedPerformance', 'creatorBaseline', 'breakoutClassification', 'thumbnailUrl'], unavailableFields: missing, calibrationStatus: CONTENT_PATTERN_CONFIG.calibrationStatus },
  };
}

/** Build the complete, deterministic P2 Phase 1 report for Long-form videos. */
export function buildContentPatternReport(input: { videos: readonly ContentPatternVideo[]; capturedAt?: string | null; snapshotId?: string | null }): ContentPatternReport {
  const receivedVideos = input.videos.length;
  const excludedShorts = input.videos.filter(video => video?.format === 'short').length;
  const videos = uniqueLongFormVideos(input.videos);
  const allCreators = sortStrings(videos.map(video => video.creatorId));
  const candidates = videos.flatMap(candidatesForVideo).sort((a, b) => a.sourceVideoId.localeCompare(b.sourceVideoId) || a.pattern.patternId.localeCompare(b.pattern.patternId));
  const grouped = new Map<string, { pattern: ContentPattern; videoIds: Set<string> }>();
  for (const candidate of candidates) {
    const current = grouped.get(candidate.pattern.patternId) || { pattern: candidate.pattern, videoIds: new Set<string>() };
    current.videoIds.add(candidate.sourceVideoId);
    grouped.set(candidate.pattern.patternId, current);
  }
  const byVideo = new Map(videos.map(video => [video.videoId, video]));
  const aggregations = [...grouped.values()].map(group => buildAggregation(group.pattern, [...group.videoIds].map(videoId => byVideo.get(videoId)!).filter(Boolean), videos.length, allCreators.length, input.capturedAt ?? null, input.snapshotId ?? null)).sort((a, b) => {
    const statusRank: Record<WinningPatternStatus, number> = { WINNING: 0, CANDIDATE: 1, INSUFFICIENT: 2 };
    return statusRank[a.winningPattern.status] - statusRank[b.winningPattern.status] || b.frequency.occurrences - a.frequency.occurrences || a.pattern.patternId.localeCompare(b.pattern.patternId);
  });
  const dataAvailability = buildContentDataAvailability(input.videos);
  return {
    schemaVersion: 'content-patterns.v1', algorithmVersion: CONTENT_PATTERN_ALGORITHM_VERSION, scope: 'LONG_FORM', dataAvailability,
    input: { receivedVideos, longFormVideos: videos.length, excludedShorts, uniqueCreators: allCreators.length },
    candidates, aggregations, winningPatterns: aggregations.filter(item => item.winningPattern.status === 'WINNING').map(item => item.winningPattern),
    gaps: ['title/duration patterns are deterministic metadata candidates, not semantic proof', 'transcript, subtitles, tags, chapters, hooks, story, editing, production, visual and audio features are not inferred', 'thresholds are provisional and require calibration against labeled Long-form outcomes'],
    provenance: { source: 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt ?? null, snapshotId: input.snapshotId ?? null, calibrationStatus: CONTENT_PATTERN_CONFIG.calibrationStatus },
  };
}

function asString(value: unknown) { return nonEmpty(value) ? value.trim() : null; }
function isPatternStatus(value: unknown): value is WinningPatternStatus { return value === 'WINNING' || value === 'CANDIDATE' || value === 'INSUFFICIENT'; }

/**
 * Trust boundary for an optional upstream report. Invalid reports are ignored
 * so the local deterministic engine can generate a conservative fallback.
 */
export function normalizeContentPatternReport(value: unknown): ContentPatternReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 'content-patterns.v1' || raw.algorithmVersion !== CONTENT_PATTERN_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.aggregations) || !Array.isArray(raw.winningPatterns) || !Array.isArray(raw.gaps) || !raw.dataAvailability || typeof raw.dataAvailability !== 'object' || !raw.input || typeof raw.input !== 'object') return null;
  const validAggregation = raw.aggregations.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const aggregation = item as Record<string, unknown>;
    const pattern = aggregation.pattern;
    const frequency = aggregation.frequency;
    const winningPattern = aggregation.winningPattern;
    if (!pattern || typeof pattern !== 'object' || !asString((pattern as Record<string, unknown>).patternId) || !asString((pattern as Record<string, unknown>).taxonomy) || !asString((pattern as Record<string, unknown>).featureValue)) return false;
    if (!frequency || typeof frequency !== 'object' || !finite((frequency as Record<string, unknown>).occurrences)) return false;
    if (!winningPattern || typeof winningPattern !== 'object' || !isPatternStatus((winningPattern as Record<string, unknown>).status)) return false;
    return true;
  });
  if (!validAggregation) return null;
  return raw as unknown as ContentPatternReport;
}
