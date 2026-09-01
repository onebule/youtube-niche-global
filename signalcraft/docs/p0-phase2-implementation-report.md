# P0 Phase 2 — Performance / Evidence / Entry Decision

## 1. Repository state

- Starting HEAD: `0afa15a` (`main`), confirmed before editing.
- Phase 1 contracts and tests were present.
- Ending HEAD: recorded after the Phase 2 commit/push.
- Pre-existing user-owned files preserved and untouched: `pnpm-workspace.yaml`, `tsconfig.tsbuildinfo`.
- No production deployment is claimed from a Git push alone.

## 2. Existing score map

- `src/lib/scoring.mjs` `opportunityScore`: legacy video-level composite of velocity, relative/outlier proxy, freshness, engagement proxy and confidence. It remains the Shorts compatibility path and is not reused as the Long-form entry decision.
- Long-form `marketOpportunity`, `executionFit`, and `entryScore`: upstream-provided values. Their formulas are not locally auditable, so Phase 2 preserves them as `UPSTREAM_OPAQUE` context.
- Radar `whyNowScore`: change/recency signal. It remains separate from the Long-form entry decision and existing Radar presentation behavior is retained.
- Channel diagnosis scores: health/diagnostic outputs, not entry recommendations.

## 3. Architecture implemented

```text
observed public metrics
  -> PerformanceAssessment (what is performing)
  -> Evidence / DataQuality (what supports the claim)
  -> ConfidenceLevel (how certain we are)
  -> EntryDecision (what action is justified)
```

`src/lib/entry-decision.ts` is the single Long-form decision boundary. It owns the canonical `ConfidenceLevel`, `EntryDecisionStatus`, deterministic reasons/blockers, rule version, performance classification and confidence gate. It has no Shorts business logic.

## 4. Implemented decision rules

- `INSUFFICIENT`: zero/near-zero sample or creator coverage, insufficient data quality, or no representative evidence. Means “we do not know yet”, not low opportunity.
- `CAUTION`: evidence quality is low or confidence is low; uncertainty is material.
- `TEST`: evidence clears the minimum bounded-test gate but does not justify scaling. This is also the ceiling when the creator baseline is not verified.
- `RECOMMENDED`: only when confidence is HIGH, data quality and creator coverage are strong, a verified baseline exists, observed performance is HIGH/VERY_HIGH, and market/execution/entry signals jointly clear their configured bars.
- `AVOID`: only after the evidence gate is strong and either the upstream explicitly returns `AVOID` or the supported supply-gap proxy is very low.

All decisions carry deterministic supporting reasons and blocking reasons. Every upstream score is explicitly labelled as opaque context and cannot bypass the local gate.

## 5. Files changed

- `src/lib/entry-decision.ts`: canonical Long-form Performance, Confidence and Entry Decision contracts/engine.
- `src/lib/longform.ts`: additive optional `performance`, `confidenceLevel`, `entryDecision`, and `upstreamAssessment` fields.
- `src/lib/longform-response.ts`: enriches normalized Long-form opportunities through the centralized engine and preserves upstream provenance.
- `src/app/longform-opportunities.tsx`: uses canonical decision status, displays observed Performance separately, and labels upstream scores as external/opaque.
- `src/lib/opportunity-presentation.ts`: names the Radar status helper as a change-signal status while retaining the old export as a compatibility alias.
- `src/lib/opportunity-radar.ts`, `src/lib/shortform-opportunity-radar.ts`: reuse the shared confidence vocabulary without changing payload behavior.
- `tests/entry-decision.test.mjs`: Phase 2 decision and confidence-gate tests.

## 6. Before / after

**Before**

```text
upstream entryScore = 88
  -> display “推荐”
```

**After**

```text
Performance: VERY_HIGH (observed growth metric)
Evidence: LOW / INSUFFICIENT when sample or creator coverage is weak
Confidence: LOW / INSUFFICIENT
Entry Decision: CAUTION / INSUFFICIENT
Reasons and blockers: deterministic and machine-readable
```

When the sample is strong but the creator baseline is unavailable, the result is at most `TEST`; it cannot become `RECOMMENDED` merely because public views or an opaque upstream score are high.

## 7. Confidence gate

The gate derives one semantic level from canonical `DataQuality` plus sample/creator coverage. `INSUFFICIENT` and `LOW` confidence materially block stronger decisions. High performance is therefore representable alongside weak evidence without silently becoming a recommendation.

## 8. Backward compatibility

- Rankings: no ranking formula or order changes.
- Discover: no candidate filtering or presentation redesign.
- Radar: `whyNowScore` remains a change signal; existing Radar status helper remains compatible.
- Shorts: legacy `calculateSignal` path and Shorts Radar payload/business fields remain unchanged; shared primitives are additive only.
- API: all new fields are optional and upstream opaque metadata is preserved when available.

## 9. Shorts regression

The existing Shorts fixture still compares the legacy `calculateSignal` output and opportunity score. Full suite and targeted regression tests pass. No Shorts scoring, historical recomputation, cache, query, or UI behavior was changed in this phase.

## 10. Validation

- TypeScript: passed.
- Targeted Phase 1 + Phase 2 tests: passed.
- Full test suite: 79 passed, 0 failed.
- `git diff --check`: passed.
- Next production build: passed.
- ESLint: repository still contains the known 2 Hooks errors and 23 warnings; no new errors were introduced by the Phase 2 domain/contract files.

## 11. Remaining risks

- Upstream formulas and snapshot metadata may still be unavailable; opaque values remain unverified by design.
- Server-side snapshot persistence and replay fixtures are not implemented in this phase.
- Existing Hooks lint errors remain outside this focused migration.

## 12. Remaining P0 blockers

- Complete upstream `schemaVersion`, `algorithmVersion`, input snapshot and decision-reason contract.
- Add replayable production fixtures for Long-form and Shorts result count/order/filter/history checks.
- Finish the existing Hooks/navigation correctness work without changing Shorts semantics.

## 13. Recommended next phase

P0 Phase 3 — Product Boundary & Decision Presentation: semantic cleanup across Rankings / Discover / Radar, URL-state consistency, evidence/decision presentation, upstream observability completion, and the remaining lint/navigation correctness work. Do not implement it automatically as part of Phase 2.
