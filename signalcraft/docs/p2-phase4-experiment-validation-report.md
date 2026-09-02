# P2 Phase 4 — Long-form Experiment & Validation Intelligence

## Scope

`experiment-validation-v1` validates a preserved Long-form strategy snapshot against real public observations. It does not rebuild the strategy engine, mutate Opportunity/Pattern/Trend decisions, schedule jobs, or run for Shorts.

The flow is:

`Strategy → Experiment → Observation → Eligibility → Expected vs Observed → Sample Sufficiency → Pattern Validation → Strategy Validation → Feedback`

## Experiment and snapshot model

`createExperimentDefinition` creates a stable ID from niche, strategy version, start time and canonical Pattern IDs when no explicit ID is supplied. It deep-copies the full strategy and stores Pattern snapshots and expected outcomes. Later strategy changes therefore cannot rewrite an existing experiment's historical context.

Expected normalized performance comes from the Pattern snapshot median when available, otherwise the centralized provisional default. The experiment plan remains semantic and all thresholds are marked `CALIBRATION_REQUIRED`.

## Observation and eligibility

Observations preserve experiment ID, video/creator/Pattern IDs, strategy role, publication/observation/capture times, public views, normalized performance, breakout multiple, baseline reference, DataQuality, confidence and provenance. Only Long-form observations with a matching experiment, known Pattern ID, supported public metric, non-insufficient data quality and minimum maturity are eligible.

Observations younger than seven days are `NOT_YET_ELIGIBLE`, not failures. Repeated snapshots remain visible as temporal observations; the latest eligible snapshot per video is used for independent sample counts.

## Evaluation

Expected-vs-observed states are `ABOVE_EXPECTATION`, `MEETS_EXPECTATION`, `BELOW_EXPECTATION` and `INSUFFICIENT`. Pattern validation requires creator breadth and repeated evidence: a single success remains insufficient; adequate multi-creator successes can validate; repeated multi-creator underperformance can contradict. Strategy validation separately considers PRIMARY and TEST outcomes; a primary failure requires strong repeated evidence before `FAILED`.

Sample states are `INSUFFICIENT`, `MINIMAL`, `ADEQUATE` and `STRONG`. Counts are unique eligible videos, creators and Patterns, with baseline coverage and duplicate-snapshot tracking.

## Feedback boundary

Pattern feedback suggests stronger consideration, review before reuse, or more evidence. Strategy feedback can be `KEEP`, `STRENGTHEN`, `REVISE`, `REDUCE`, `STOP` or `INSUFFICIENT`. Opportunity feedback is evidence-only (`PRESERVE_AS_EVIDENCE`); EntryDecision, EntryWindow, lifecycle, saturation and historical Pattern/Strategy truth are never silently mutated.

CTR, retention, average view duration, impressions, traffic sources, subscriber gain, revenue and RPM are not inferred. They remain unavailable or require authenticated YouTube data.

## Validation

`tests/experiment-validation.test.mjs` covers one success, repeated multi-creator success, viral outlier, repeated underperformance, immaturity, missing baseline, duplicate/repeated snapshots, historical strategy snapshots, Shorts isolation and calibration metadata. The existing P0/P1/P2 suites remain the regression gate.

