/**
 * Shared, additive evidence primitives.
 *
 * This module deliberately contains no scoring or product-domain rules. It is
 * a transport-safe vocabulary used by Long-form and Shorts responses so a
 * conclusion can state where it came from without changing either domain's
 * business logic.
 */
export const EVIDENCE_SCHEMA_VERSION = 'evidence.v1';
export const DATA_QUALITY_SCHEMA_VERSION = 'data-quality.v1';

export type EvidenceType = 'FACT' | 'INFERENCE' | 'LOW_CONFIDENCE';
export type DataQualityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type DataValueState = 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type BaselineStatus = 'VERIFIED' | 'INSUFFICIENT' | 'UNAVAILABLE';

export type EvidenceFact = {
  statement: string;
  type: 'FACT';
  source?: string | null;
};

export type EvidenceInference = {
  statement: string;
  type: 'INFERENCE' | 'LOW_CONFIDENCE';
  source?: string | null;
};

export type EvidenceContract = {
  schemaVersion: string;
  algorithmVersion?: string | null;
  snapshotId?: string | null;
  requestId?: string | null;
  capturedAt?: string | null;
  source?: string | null;
  facts?: EvidenceFact[];
  inferences?: EvidenceInference[];
  missing?: string[];
};

export type DataQuality = {
  level: DataQualityLevel;
  sampleVideos?: number | null;
  sampleChannels?: number | null;
  capturedAt?: string | null;
  dateSpan?: { start?: string | null; end?: string | null } | null;
  freshness?: number | string | null;
  completeness?: number | null;
  missingFields?: string[];
  outlierDependence?: number | string | null;
  creatorConcentration?: number | null;
  classificationConfidence?: number | null;
  source?: string | null;
  schemaVersion: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finiteNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : [];

function validIso(value: unknown): string | null {
  const candidate = text(value);
  return candidate && Number.isFinite(new Date(candidate).getTime()) ? candidate : null;
}

export function normalizeEvidence(value: unknown, fallback?: Partial<EvidenceContract>): EvidenceContract {
  const raw = isRecord(value) ? value : {};
  const facts = Array.isArray(raw.facts)
    ? raw.facts.flatMap((item): EvidenceFact[] => {
      if (typeof item === 'string' && item.trim()) return [{ statement: item.trim(), type: 'FACT' }];
      if (!isRecord(item)) return [];
      const statement = text(item.statement);
      return statement ? [{ statement, type: 'FACT', source: text(item.source) }] : [];
    })
    : [];
  const inferences = Array.isArray(raw.inferences)
    ? raw.inferences.flatMap((item): EvidenceInference[] => {
      if (typeof item === 'string' && item.trim()) return [{ statement: item.trim(), type: 'INFERENCE' }];
      if (!isRecord(item)) return [];
      const statement = text(item.statement);
      if (!statement) return [];
      const type = item.type === 'LOW_CONFIDENCE' ? 'LOW_CONFIDENCE' : 'INFERENCE';
      return [{ statement, type, source: text(item.source) }];
    })
    : [];
  return {
    schemaVersion: text(raw.schemaVersion) || fallback?.schemaVersion || EVIDENCE_SCHEMA_VERSION,
    algorithmVersion: text(raw.algorithmVersion) ?? fallback?.algorithmVersion ?? null,
    snapshotId: text(raw.snapshotId) ?? fallback?.snapshotId ?? null,
    requestId: text(raw.requestId) ?? fallback?.requestId ?? null,
    capturedAt: validIso(raw.capturedAt) ?? fallback?.capturedAt ?? null,
    source: text(raw.source) ?? fallback?.source ?? null,
    facts,
    inferences,
    missing: stringList(raw.missing),
  };
}

export function normalizeDataQuality(value: unknown, fallback: Partial<DataQuality> = {}): DataQuality {
  const raw = isRecord(value) ? value : {};
  const rawSpan = isRecord(raw.dateSpan) ? raw.dateSpan : {};
  const explicit = text(raw.level) as DataQualityLevel | null;
  const level: DataQualityLevel = explicit === 'HIGH' || explicit === 'MEDIUM' || explicit === 'LOW' || explicit === 'INSUFFICIENT'
    ? explicit
    : fallback.level || 'INSUFFICIENT';
  const completeness = finiteNumber(raw.completeness) ?? finiteNumber(fallback.completeness);
  return {
    level,
    sampleVideos: finiteNumber(raw.sampleVideos) ?? fallback.sampleVideos ?? null,
    sampleChannels: finiteNumber(raw.sampleChannels) ?? fallback.sampleChannels ?? null,
    capturedAt: validIso(raw.capturedAt) ?? fallback.capturedAt ?? null,
    dateSpan: (isRecord(raw.dateSpan) || Boolean(fallback.dateSpan)) ? { start: validIso(rawSpan.start) ?? fallback.dateSpan?.start ?? null, end: validIso(rawSpan.end) ?? fallback.dateSpan?.end ?? null } : null,
    freshness: finiteNumber(raw.freshness) ?? text(raw.freshness) ?? fallback.freshness ?? null,
    completeness: completeness === null ? null : Math.max(0, Math.min(100, completeness)),
    missingFields: stringList(raw.missingFields).length ? stringList(raw.missingFields) : fallback.missingFields || [],
    outlierDependence: finiteNumber(raw.outlierDependence) ?? text(raw.outlierDependence) ?? fallback.outlierDependence ?? null,
    creatorConcentration: finiteNumber(raw.creatorConcentration) ?? fallback.creatorConcentration ?? null,
    classificationConfidence: finiteNumber(raw.classificationConfidence) ?? fallback.classificationConfidence ?? null,
    source: text(raw.source) ?? fallback.source ?? null,
    schemaVersion: text(raw.schemaVersion) || fallback.schemaVersion || DATA_QUALITY_SCHEMA_VERSION,
  };
}

export function deriveDataQuality(input: {
  sampleVideos?: number | null;
  sampleChannels?: number | null;
  completeness?: number | null;
  capturedAt?: string | null;
  source?: string | null;
  missingFields?: string[];
}): DataQuality {
  const sampleVideos = input.sampleVideos ?? 0;
  const sampleChannels = input.sampleChannels ?? 0;
  const completeness = input.completeness ?? null;
  const level: DataQualityLevel = sampleVideos <= 0
    ? 'INSUFFICIENT'
    : completeness !== null && completeness < 25
      ? 'INSUFFICIENT'
      : sampleVideos < 5 || sampleChannels < 2
        ? 'LOW'
        : completeness !== null && completeness < 70
          ? 'MEDIUM'
          : 'HIGH';
  return normalizeDataQuality({ level, sampleVideos, sampleChannels, completeness, capturedAt: input.capturedAt, source: input.source, missingFields: input.missingFields }, { schemaVersion: DATA_QUALITY_SCHEMA_VERSION });
}
