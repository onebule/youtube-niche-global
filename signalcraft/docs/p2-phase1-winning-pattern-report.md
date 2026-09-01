# P2 Phase 1 — Long-form Content Intelligence & Winning Patterns

Status: implemented locally; thresholds remain `CALIBRATION_REQUIRED`.

## Boundary

This phase adds a Long-form-only content pattern layer. The existing Shorts
collection, scoring, ranking, history, API contract and case-pattern library
remain unchanged. `src/lib/viral-patterns.ts` is an editorial reference set for
Shorts cases; it is not used as evidence for Long-form patterns.

## Evidence pipeline

`Video evidence → deterministic metadata feature extraction → PatternCandidate
→ stable Pattern ID → cross-video aggregation → cross-creator validation →
normalized PatternPerformance → breakout evidence → repeatability → confidence
→ WinningPattern`

The engine lives in `src/lib/content-patterns.ts` and exposes one report shape
(`ContentPatternReport`) containing the canonical `ContentPattern`,
`PatternCandidate`, `PatternEvidence`, `PatternAggregation`,
`PatternPerformance`, `PatternRepeatability`, `CrossCreatorPatternEvidence` and
`WinningPattern` concepts.

## What the current public response supports

| Field group | Status | Rule |
| --- | --- | --- |
| title, duration, channel, niche, views, thumbnail | AVAILABLE/PARTIAL | Count only values actually present in the saved response. |
| format, topic and title/duration structures | DERIVABLE | Explicit Long-form gate plus deterministic title and duration rules. |
| normalized creator performance and breakout | PARTIAL | Used only when a valid baseline/breakout value is supplied. |
| transcript, subtitles, tags, chapters, embeddings | REQUIRES_NEW_DATA | No fallback or fabricated value. |
| hook, story, editing, production method | REQUIRES_LLM | Not inferred from title or duration. |
| visual features | REQUIRES_VISION | A thumbnail is not treated as full-video visual evidence. |
| audio features | REQUIRES_NEW_DATA | No audio stream in the current contract. |

## Winning gate

A pattern is `WINNING` only when it has at least five eligible Long-form
videos, three independent creators, three breakout-assessable videos, breakout
evidence from at least two creators, and three comparable normalized
performance observations with a median at or above the provisional baseline.
Otherwise it remains `CANDIDATE` or `INSUFFICIENT`. Frequency, creator breadth,
performance, breakout rate, repeatability and confidence are displayed as
separate fields; no combined mystery score is introduced.

## Product surface

The Long-form opportunity card now includes a compact `P2 PHASE 1 · CONTENT
INTELLIGENCE` panel. It shows candidate/winning status, occurrence frequency,
independent creator breadth, normalized median (or `UNKNOWN`), breakout rate,
repeatability and field coverage. The panel explicitly states which deeper
content features are not available. No Idea generation, Strategy Generator or
Canvas handoff is introduced in this phase.

## Verification

`tests/content-patterns.test.mjs` covers availability auditing, stable IDs,
Shorts isolation, raw-view protection, cross-creator winning gates, duplicate
deduplication, deterministic replay and one-creator confidence blocking.
