# P1 Phase 4 — Unified Opportunity Engine & Entry Window

## Scope

Phase 4 adds one canonical, Long-form-only `OpportunityAssessment`. It composes P0 performance/data-quality/evidence contracts, Phase 2 creator-breakout signals and Phase 3 lifecycle/supply-demand evidence. Rankings, Discover ordering, Radar semantics, Canvas and all Shorts paths are unchanged.

## Evidence availability

| Evidence | Status | Treatment |
| --- | --- | --- |
| Current public performance | AVAILABLE/PARTIAL | P0 `PerformanceAssessment`; unknown stays unknown. |
| DataQuality and EvidenceContract | AVAILABLE/PARTIAL | Canonical gate and provenance. |
| Demand momentum, supply growth, lifecycle, saturation | PARTIAL | Reused Phase 3; retrospective provenance is retained. |
| Breakout breadth, small-creator access, concentration | PARTIAL | Reused Phase 2/3 definitions; no second formula. |
| Execution fit | UPSTREAM_OPAQUE | Context only; cannot produce RECOMMENDED. |
| Market opportunity / entry score | UPSTREAM_OPAQUE | Preserved in `upstreamAssessment`; cannot bypass local gates. |
| RPM, revenue, production cost, search demand | UNAVAILABLE | Remain unknown; public benchmarks are not decision evidence. |

## Implemented dimensions

`DEMAND_STRENGTH`, `DEMAND_MOMENTUM`, `CREATOR_ACCESSIBILITY`, `BREAKOUT_BREADTH`, `COMPETITION_PRESSURE`, `SATURATION_RISK`, `CREATOR_CONCENTRATION`, `LIFECYCLE_POSITION`, `EXECUTION_FIT`, and `EVIDENCE_STRENGTH` are explicit semantic dimensions. Each carries a state, optional supporting value, confidence, evidence references, provenance and calibration status. No weighted OpportunityScore was introduced.

Accessibility and breakout breadth intentionally point to the same Phase 2 creator evidence when both are available; they are composed as a rule-based “breadth + access” check, never added as independent weighted points.

## Decision flow

`Evidence → dimensions → evidence gate → risks/support → Entry Window → canonical EntryDecision`.

The gate requires a traceable niche identity, at least 5 videos, at least 2 creators for a minimal decision (3 for strong cross-creator interpretation), at least 1 representative video and non-insufficient data quality. Strong saturation, falling lifecycle and high concentration remain negative evidence. `RECOMMENDED` additionally requires HIGH confidence/quality, 20 videos, 5 creators, verified baseline, multi-creator breakout support and an OPEN window. Opaque upstream values never satisfy these gates.

## Entry Window rules

- `OPEN`: EMERGING/GROWING/MATURE lifecycle, usable demand, creator accessibility and no high competition/saturation blocker.
- `NARROWING`: demand may remain usable, but supply, concentration, falling momentum or moderate saturation pressure is increasing.
- `CLOSED`: strong saturation/declining conditions agree with weak access or high concentration.
- `UNDETERMINED`: comparable lifecycle/trend evidence is missing or insufficient.

Entry Window is a classification of current structural conditions, not a forecast horizon; no months-until-close estimate is emitted. Retrospective windows remain labelled `RETROSPECTIVE` and cap their interpretation.

## Deterministic fixtures

Covered fixtures include strong growing evidence, famous/concentrated saturation, weak evidence plus opaque score 95, high breakout with rising saturation, mature-but-testable, declining, retrospective-only, missing lifecycle and deterministic replay. Strong negative evidence can produce `CLOSED`/`AVOID`; weak evidence produces `INSUFFICIENT` or `CAUTION`; positive but bounded evidence produces `TEST`.

## Files

- `src/lib/opportunity-engine.ts`: canonical Phase 4 dimensions, gates, conflict resolution, Entry Window and EntryDecision composition.
- `src/lib/longform.ts`: optional `opportunityAssessment` on Long-form opportunities.
- `src/lib/longform-response.ts`: computes the local assessment after untrusted response normalization.
- `src/app/longform-opportunities.tsx` / `.css`: minimal decision-first presentation with dimensions, reasons, risks and provenance.
- `tests/opportunity-engine.test.mjs`: deterministic Phase 4 fixtures and replay.

## Product impact

Long-form Evaluation is the canonical Phase 4 surface. Rankings are not reranked, Discover is not silently changed, Radar remains “what changed”, Shorts remains isolated, and Canvas is untouched.

## Calibration and remaining risks

All Phase 4 thresholds in `OPPORTUNITY_ENGINE_CONFIG` are `CALIBRATION_REQUIRED`; Phase 1/2/3 calibration labels remain intact. Live API coverage may still omit niche identity, repeated snapshots, subscriber coverage and creator baselines. Those gaps intentionally produce partial or insufficient results.

## Completion

- P1 Phase 4: `COMPLETE` after typecheck, 135-test full suite, targeted fixtures, ESLint (0 errors), production build and `git diff --check`.
- Opportunity Engine foundation: `READY` for Long-form evaluation, subject to production calibration and live API coverage.
- Deployment: this repository change is ready to push; production hosting status is reported separately and is not inferred from Git.
