# P1 Phase 3 — Saturation, Supply/Demand Dynamics & Niche Lifecycle

## 1. Repository State

- Starting HEAD: `3967804` (`Aggregate Long-form breakout niche signals`)
- Ending HEAD: recorded by the final commit; verify with `git rev-parse HEAD`
- Branch: `main`
- Push status: recorded only after the final commit is pushed and `origin/main` matches
- Preserved unrelated user-owned files: `pnpm-workspace.yaml`, `tsconfig.tsbuildinfo`

## 2. Historical Data Audit

| Input | Status | Finding |
| --- | --- | --- |
| Repeated historical view snapshots | PARTIAL | The domain accepts true snapshot windows, but the live public Long-form endpoint does not guarantee repeated snapshots for every video. |
| Video publication dates | AVAILABLE/PARTIAL | Available where upstream supplies `publishedAt`; not required to invent missing snapshots. |
| Niche identity | PARTIAL | A canonical explicit `nicheId` is required; broad YouTube categories are not used as invented niches. |
| Creator/channel identity | AVAILABLE/PARTIAL | Required in the temporal observation contract; live coverage remains upstream-dependent. |
| Subscriber count | PARTIAL | Used only for Phase 2 small-creator trend when known; unknown remains unknown. |
| Phase 1/2 breakout and concentration evidence | PARTIAL | Reused when supplied with valid baselines and Phase 2 denominators. |
| Capture dates and coverage | PARTIAL | Window coverage is accepted explicitly and gates comparability when provided. |

True repeated historical view snapshots are not assumed to exist. The implementation never interpolates a 30-day-old view count from today’s lifetime views.

## 3. Time Semantics

The contract carries `TRUE_SNAPSHOT_HISTORY`, `PUBLICATION_COHORT_HISTORY`, `CURRENT_PUBLIC_CORPUS`, or `UNKNOWN` for each window. Current live product evidence is normally `CURRENT_PUBLIC_CORPUS` or `PUBLICATION_COHORT_HISTORY`; those results are labelled `RETROSPECTIVE`. Unknown semantics or missing comparable history produces `INSUFFICIENT`. Only two explicit true-snapshot windows receive `TRUE_SNAPSHOT_HISTORY` provenance.

## 4. Window Architecture

`compareNicheWindows` is the single comparison gate. It requires the same explicit niche and Long-form format, valid dates, at least 14 days per window, duration ratio within ±20%, and at least five videos and three creators in each window. Optional coverage is compared using the lower window coverage and must meet 60%. Both windows retain start/end, duration, time semantics, coverage, sample counts, blockers, and provenance. Growth rates use `(current - comparison) / comparison` only when the prior value is positive; otherwise the trend is `INSUFFICIENT` rather than an exaggerated percentage.

## 5. Supply Metrics

Each window exposes `videoSupply`, `eligibleVideoSupply`, `activeCreators`, `newlyObservedCreators` (newly observed in this corpus, not newly created YouTube channels), `videosPerCreator`, `publicationRate` normalized to 30 days, and `totalViews`. Supply metrics are deduplicated by canonical video ID. `eligibleVideoSupply` is the valid-baseline population used by Phase 2 breakout aggregation.

## 6. Observed Demand Proxy

The v1 proxy is intentionally named `ObservedDemandAssessment`. It reports median and P75 normalized per-video performance, where a supplied `normalizedPerformance` is preferred and otherwise public views are divided by the video’s age in the window (at least one day). It records the window, time semantics, mature/eligible sample, unit, confidence, and an explicit note.

This means observable audience-side public performance per video. It does not mean YouTube search volume, search demand, CTR, retention, revenue, or a forecast. Total views remain a separate supply-sensitive metric and are never used alone as demand.

## 7. Supply vs Demand Relationship

Implemented states are `INSUFFICIENT`, `DEMAND_OUTPACING_SUPPLY`, `BALANCED_GROWTH`, `SUPPLY_OUTPACING_DEMAND`, `BOTH_DECLINING`, and `MIXED`. Rules compare supply growth with the normalized-performance trend; missing or incomparable values remain insufficient. A doubled video count with flat per-video performance cannot become healthy demand acceleration.

## 8. Trend Evidence

- Creator growth: active creator counts and newly observed creator counts are kept separate; creator growth is not channel-creation growth.
- Per-video performance: median normalized performance and P75 are calculated independently of total views.
- Breakout trend: Phase 2 `breakoutDensity` and `strongBreakoutDensity` are compared using the same valid-baseline denominator.
- Small-creator trend: Phase 2 `smallCreatorBreakoutRate` is compared only where subscriber coverage is known; unknown subscribers remain excluded from size-specific rates.
- Concentration trend: Phase 2 `eligible_video_views_by_creator` Top 1/Top 3 shares are reused exactly, with percentage-point changes exposed as trend metrics.

## 9. Saturation Signals

The typed signal set is `SUPPLY_ACCELERATION`, `CREATOR_ACCELERATION`, `OBSERVED_DEMAND_ACCELERATION`, `SUPPLY_OUTPACING_DEMAND`, `PERFORMANCE_DILUTION`, `BREAKOUT_ACCESS_IMPROVING`, `BREAKOUT_ACCESS_DECLINING`, `CREATOR_CONCENTRATION_RISING`, `CREATOR_CONCENTRATION_FALLING`, `SATURATION_RISING`, and `SATURATION_EASING`.

Signals carry current/comparison values, changes, sample sizes, confidence, reasons, blockers, and `niche-lifecycle-v1`. `SATURATION_RISING=STRONG` requires supply materially rising, normalized performance materially declining, and at least one additional negative competition/access dimension (breakout access decline, concentration rise, or material creator acceleration). A single metric cannot emit strong saturation. `SATURATION_EASING` is additive evidence when at least two positive dimensions agree. All thresholds are provisional.

## 10. Lifecycle

The deterministic states are `INSUFFICIENT`, `EMERGING`, `GROWING`, `MATURE`, `SATURATED`, and `DECLINING`; `EXPANDING` was not added because the current evidence cannot reliably separate it from growth.

- `INSUFFICIENT`: failed comparable-window, sample, coverage, identity, or time-semantics gates.
- `EMERGING`: valid sample, relatively low current supply, and rising creator participation plus normalized performance.
- `GROWING`: supply and observed-performance trends rise without multi-dimensional saturation pressure.
- `MATURE`: supply, creators, demand proxy, and normalized performance are all stable.
- `SATURATED`: the strong multi-dimensional saturation gate is met.
- `DECLINING`: both demand/performance evidence and/or the supply-demand relationship show sustained deterioration without the stronger supply-pressure saturation pattern.

Every state carries confidence, reasons, blockers, and provenance. Retrospective cohort results remain explicitly `RETROSPECTIVE`; lifecycle is never mapped directly to `EntryDecision` or `AVOID`.

## 11. Calibration

`NICHE_LIFECYCLE_CONFIG` centralizes all Phase 3 thresholds, all marked `CALIBRATION_REQUIRED`: minimum videos per window `5`, minimum creators `3`, minimum coverage `60%`, minimum date span `14 days`, comparable duration tolerance `±20%`, material growth `20%`, stable-change band `10%`, performance dilution `-15%`, breakout trend change `15%`, concentration trend change `10 percentage points`, strong saturation support `2` negative dimensions plus the supply/performance gate, publication-rate scale `30 days`, and emerging current-supply ceiling `20 videos`. Phase 1/2 calibration metadata remains unchanged.

## 12. Files Changed

| Path | Purpose | Behavior change |
| --- | --- | --- |
| `src/lib/niche-lifecycle.ts` | Pure Long-form window comparison, dynamics, supply/demand, saturation, lifecycle, evidence and boundary normalization | Adds temporal evidence without fabricating history or writing decisions. |
| `src/lib/longform.ts` | Long-form entity extension | Adds optional `nicheLifecycle`. |
| `src/lib/longform-response.ts` | Untrusted response boundary | Safely accepts optional lifecycle evidence. |
| `src/app/longform-opportunities.tsx` | Minimal Long-form presentation | Adds optional localized lifecycle/provenance evidence; no score or decision rewrite. |
| `src/app/longform-opportunities.css` | Evidence styling | Adds compact lifecycle evidence styling. |
| `tests/niche-lifecycle.test.mjs` | Deterministic Phase 3 fixtures | Covers comparable windows, growth, crowding, mature, decline, tiny denominators, missing history, total-view trap, duplicates, provenance and Shorts isolation. |
| `tests/longform-response.test.mjs` | Boundary regression | Verifies optional lifecycle evidence survives normalization. |
| `tests/p0-phase3-replay-fixtures.test.mjs` | Replay regression | Verifies retrospective lifecycle replay is deterministic. |
| `docs/p1-phase3-lifecycle-report.md` | Audit and implementation report | Records semantics, formulas, calibration and validation. |

## 13. Fixture Outputs

- Healthy growth: supply `+20%`, normalized performance `+60%` → `DEMAND_OUTPACING_SUPPLY`, lifecycle `EMERGING` or `GROWING` depending on current supply ceiling.
- Supply crowding: supply `+70%`, performance `-25%` plus concentration/access pressure → `SUPPLY_OUTPACING_DEMAND`, `SATURATION_RISING=STRONG`, lifecycle `SATURATED`.
- Balanced expansion: supply and normalized performance rise within a similar range → growth state, not saturation.
- Mature stable: all core trends stable → `MATURE`.
- Declining: normalized performance and audience proxy fall without rising supply-pressure gate → `DECLINING`.
- Tiny denominator or missing comparison window → `INSUFFICIENT` with blockers.
- Publication cohorts → explicit `RETROSPECTIVE` provenance.
- Duplicate rows → deduplicated video supply and no artificial growth.

## 14. Product Impact

- Rankings: ordering and public-performance semantics unchanged.
- Discover: no rerank or redesign; lifecycle evidence is not injected into candidate ordering.
- Radar: no redesign or semantic change; typed temporal signals are Radar-ready domain evidence only.
- Long-form Evaluation: optional additive lifecycle/saturation evidence; no direct `EntryDecision` or `AVOID` mapping.
- Shorts: Long-form rules are rejected by the domain contract; existing Shorts collection, history, filters, rankings, scoring, API and UI remain isolated.
- Canvas: unchanged.

## 15. Regression

Phase 1 creator baselines and breakout classifications are reused rather than redefined. Phase 2 breakout-density denominator and Top 1/Top 3 concentration scope are reused unchanged. Existing P0, P1, Shorts, response, radar, decision, and UI contract tests remain green.

## 16. Validation

- TypeScript: passed (`tsc --noEmit --pretty false`)
- Targeted Phase 3/response/replay tests: passed (25 tests)
- Full test suite: passed (after final code validation)
- Shorts regression: passed through existing Shorts scoring, radar, response, and diagnostic tests
- ESLint: passed with 0 errors; existing warnings are documented with the final run
- Next.js production build: passed on the final code
- `git diff --check`: passed

## 17. Remaining Risks

- The live endpoint still does not guarantee true repeated historical snapshots, explicit niche identity, complete creator coverage, or subscriber coverage. The system therefore returns partial/retrospective/insufficient states rather than pretending those fields exist.
- Thresholds are not calibrated against a representative production distribution.
- Publication-cohort normalized performance is retrospective evidence and should not be presented as real-time demand or lifecycle tracking.

## 18. P1 Phase 3 Completion Assessment

`P1 PHASE 3 COMPLETE` when the final validation values above are green. The implementation contains comparable-window gates, explicit time semantics, supply/demand dynamics, normalized per-video trends, reused breakout/concentration semantics, multi-signal saturation, deterministic lifecycle states, provenance, Long-form-only integration, replay fixtures, and preserved Shorts/P0/P1 behavior. No Phase 4 Opportunity Engine was implemented.

## 19. Recommended Next Phase

**P1 Phase 4 — Unified Opportunity Engine & Entry Window** may be planned separately to combine lifecycle, saturation, demand dynamics, creator accessibility, concentration, execution fit, and trustworthy monetization evidence into explainable opportunity dimensions and the canonical EntryDecision. It is not implemented automatically.
