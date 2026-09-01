# P1 Phase 2 — Small Creator Breakout & Niche-Level Opportunity Signals

## 1. Repository State

- Starting HEAD: `2c79679` (`Add creator baseline breakout evidence`)
- Ending HEAD: recorded by the final commit; verify with `git rev-parse HEAD`
- Branch: `main`
- Push status: reported only after the final commit is pushed and `origin/main` is verified
- Preserved unrelated user-owned files: `pnpm-workspace.yaml`, `tsconfig.tsbuildinfo`

## 2. Data Availability

| Input | Status | Finding |
| --- | --- | --- |
| Niche identity | PARTIAL | Aggregation requires an explicit existing `nicheId`; this phase does not invent broad category membership. |
| Video ID | AVAILABLE | Required canonical identity; duplicate IDs are removed before aggregation. |
| Creator/channel ID | AVAILABLE/PARTIAL | Required by the contract and available where upstream Long-form evidence supplies it; current public response does not guarantee creator-level coverage for every row. |
| Subscriber count | PARTIAL | Known non-negative values support size cohorts; missing values remain `UNKNOWN_SIZE` and are excluded only from size-specific calculations. |
| Creator baseline/breakout | PARTIAL | Phase 1 evidence is consumed when supplied; missing or insufficient baseline evidence is excluded from breakout density. |
| Views | PARTIAL | Used for concentration only when finite and non-negative. |
| Historical/capture windows | PARTIAL | The summary declares `current-public-corpus`; a complete repeated snapshot history is not guaranteed by the current public endpoint. |

## 3. Aggregation Architecture

`buildNicheBreakoutSummary` filters to the requested niche and `format: 'long'`, requires creator/video identity, deduplicates by video ID, and then admits only Phase 1 observations with a verified, non-insufficient baseline, a non-insufficient breakout classification, and a valid non-negative breakout multiple. `eligibleVideos` is therefore the denominator for breakout density; unassessable rows do not silently lower or inflate the rate.

Video-level counts (`breakoutVideos`, `strongBreakoutVideos`) and unique creator counts (`breakoutCreators`, `strongBreakoutCreators`) are kept separate. Repeated evidence is counted once per creator, and `REPEATED_CROSS_CREATOR` requires repeated evidence from at least two creators plus cross-creator breadth. One prolific creator cannot satisfy cross-creator breadth by producing many videos.

## 4. Small Creator Definition

The single canonical threshold is `NICHE_SIGNAL_CONFIG.smallCreatorMaxSubscribers = 100000` (strictly `< 100,000`, status `CALIBRATION_REQUIRED`). The small-creator denominator is `eligibleSmallCreators`, meaning unique creators with known non-negative subscribers in the eligible set. `smallCreatorBreakoutRate` is `smallBreakoutCreators / eligibleSmallCreators`.

Unknown subscriber values are never converted to zero. They contribute to ordinary Long-form breakout evidence, but not to the small-creator numerator or denominator; `knownCreatorSizeCount`, `unknownCreatorSizeCount`, and coverage are exposed and low coverage downgrades the small-creator signal confidence.

## 5. Creator Concentration

The implemented metric is transparent view concentration: aggregate eligible video views by creator, sort creator totals descending, and calculate `Top1Share = top creator views / total eligible views` and `Top3Share = top three creator views / total eligible views`. Scope is explicitly `eligible_video_views_by_creator`; it is not subscriber concentration and is not an opportunity score.

With the provisional thresholds, Top 3 share `>= 70%` emits `CREATOR_CONCENTRATION_HIGH`, while `<= 45%` emits `CREATOR_CONCENTRATION_LOW`. Fewer than three eligible creators or missing valid views produces `INSUFFICIENT` concentration.

## 6. Niche Signals

The typed signals are `SMALL_CREATOR_BREAKOUT`, `CROSS_CREATOR_BREAKOUT`, `REPEATED_BREAKOUT`, `BREAKOUT_DENSITY_HIGH`, `CREATOR_CONCENTRATION_HIGH`, and `CREATOR_CONCENTRATION_LOW`. Each carries strength (`INSUFFICIENT`, `WEAK`, `MODERATE`, `STRONG`), canonical confidence, evidence counts, reasons, blockers, and `niche-signals-v1`.

- `CROSS_CREATOR_BREAKOUT`: unique breakout creators; at least three are required before a non-insufficient breadth conclusion.
- `SMALL_CREATOR_BREAKOUT`: at least three eligible small creators and at least two small breakout creators; size coverage below 60% lowers confidence.
- `REPEATED_BREAKOUT`: repeated Phase 1 evidence from at least two creators and cross-creator breadth; one creator alone cannot produce this signal.
- `BREAKOUT_DENSITY_HIGH`: breakout videos divided by eligible baseline-assessable videos; 30% is strong and 15% is moderate under the provisional configuration.
- Concentration signals: view-distribution evidence only; neither implies opportunity or entry.

Signal confidence is sample-aware: fewer than five eligible videos or three eligible creators is `INSUFFICIENT`; a high-confidence result also requires at least 20 videos, eight creators, and adequate subscriber coverage where relevant. Low baseline confidence caps a would-be strong signal to moderate. No signal writes `EntryDecision` or a 0–100 score.

## 7. Calibration

All Phase 2 values below are provisional and marked `CALIBRATION_REQUIRED`: minimum eligible videos `5`, minimum eligible creators `3`, minimum cross-creator breakout creators `3`, minimum eligible small creators `3`, minimum small breakout creators `2`, minimum repeated-breakout creators `2`, small creator cutoff `<100,000 subscribers`, high/moderate density `30%/15%`, high/low Top 3 share `70%/45%`, high-confidence sample `20 videos + 8 creators`, and minimum known subscriber coverage `60%`. Phase 1 creator-baseline thresholds remain provisional as documented in the Phase 1 report.

## 8. Files Changed

| Path | Purpose | Behavior change |
| --- | --- | --- |
| `src/lib/niche-signals.ts` | Pure Long-form niche aggregation, cohorts, density, repetition, concentration, typed signals, normalization | Adds optional evidence domain; no score or decision mapping. |
| `src/lib/longform.ts` | Long-form entity extension | Adds optional `nicheSignals` without changing existing fields. |
| `src/lib/longform-response.ts` | Untrusted response boundary | Safely normalizes optional upstream niche evidence. |
| `src/app/longform-opportunities.tsx` | Minimal evidence presentation | Adds localized signal badges and density/repetition/concentration context only when evidence exists. |
| `src/app/longform-opportunities.css` | Evidence styling | Adds compact additive signal presentation. |
| `tests/niche-signals.test.mjs` | Deterministic Phase 2 cases and replay | Covers 12 required cases plus replay. |
| `tests/longform-response.test.mjs` | Boundary regression | Verifies optional niche evidence survives normalization. |
| `tests/p0-phase3-replay-fixtures.test.mjs` | Replay regression | Verifies stable niche signal types and creator breadth. |

## 9. Fixture Examples

- One creator dominance: 8 breakout videos from one creator → `eligibleCreators=1`, `breakoutCreators=1`, `CROSS_CREATOR_BREAKOUT=INSUFFICIENT`.
- Broad small-creator breakout: 8 independent small creators, 5 breakout creators → `eligibleSmallCreators=8`, `smallBreakoutCreators=5`, `SMALL_CREATOR_BREAKOUT=STRONG`.
- Unknown subscriber coverage: six eligible creators with no subscriber values → `knownCreatorSizeCount=0`, `unknownCreatorSizeCount=6`; ordinary breakout aggregation remains possible while small-creator confidence is `LOW`.
- Concentration fixtures distinguish high Top 3 view share from low Top 3 view share without producing an opportunity verdict.
- Replay uses the same JSON input and algorithm version and asserts deep equality of the full summary.

## 10. Product Impact

- Rankings: unchanged; no rerank by breakout density or niche signals.
- Discover: unchanged; no redesign or silent rerank.
- Radar: unchanged; no redesign or semantic change.
- Long-form Evaluation: optional, additive evidence block only; signal strength never bypasses canonical `EntryDecision` gates.
- Shorts: unchanged and isolated. The new builder rejects non-Long-form observations, and existing Shorts scoring, counts, sorting, filters, history, API shape, and UI paths remain untouched.

## 11. Validation

- TypeScript: passed (`tsc --noEmit --pretty false`)
- Targeted Phase 2/response/replay tests: passed (22 tests)
- Full test suite: passed (110 tests)
- Shorts regression: passed through existing Shorts scoring, radar, response, and diagnostic tests
- ESLint: passed with 0 errors and 23 existing warnings
- Next production build: passed on Next.js 16.2.6 (Turbopack)
- `git diff --check`: passed

## 12. Remaining Risks

- The live Long-form public endpoint does not guarantee explicit niche IDs, complete creator metadata, subscriber coverage, or repeated snapshots for every row; affected summaries correctly remain partial or insufficient.
- Thresholds have not been calibrated against a representative production distribution and must not be presented as scientifically final.
- The current temporal window is a retrospective current public corpus, not a full lifecycle or acceleration model.

## 13. P1 Phase 2 Completion Assessment

`P1 PHASE 2 COMPLETE`. The repository now has unique-creator aggregation, defensible eligible denominators, small-creator and unknown-size handling, repeated cross-creator evidence, explicit view concentration, typed explainable signals, confidence gates, deterministic fixtures, optional Long-form presentation, and preserved Shorts/P0/P1 behavior. No final Opportunity Engine, saturation, lifecycle, or EntryDecision rewrite was implemented.

## 14. Recommended Next Phase

**P1 Phase 3 — Saturation, Supply-Demand & Niche Lifecycle Signals** may be planned separately for supply growth, demand growth, creator growth, views/video trends, breakout trends, concentration trends, saturation, and lifecycle classification. It is not implemented in this change.
