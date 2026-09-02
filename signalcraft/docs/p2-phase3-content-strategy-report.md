# P2 Phase 3 — Long-form Content Strategy

## Scope

`content-strategy-v1` is a deterministic Long-form-only layer. It consumes the existing Opportunity Assessment, P2 Phase 1 Pattern Report, P2 Phase 2 Pattern Trend and Niche-Pattern Fit. It does not change any upstream rules and it never runs for Shorts.

The output stops at strategy: pattern roles, structural positioning and a validation guardrail. It does not generate video ideas, titles, hooks, scripts, thumbnails, storyboards or Canvas work.

## Decision flow

`Opportunity Context → Pattern Evidence → Pattern Trend → Niche Fit → Selection Rules → Pattern Roles → Positioning → Experiment Plan → Confidence → Risks / Blockers / Provenance`

The strategy object is `ContentStrategy` in `src/lib/content-strategy.ts`. It contains `PRIMARY`, `TEST`, `WATCH`, `DEPRIORITIZE`, `AVOID` and `INSUFFICIENT` collections, rather than another 0–100 score.

## Role rules

- `PRIMARY`: `WINNING`, `TOP_FIT` or `STRONG_FIT`, positive trend (`ACCELERATING`, `GROWING` or `STABLE`), at least medium pattern confidence, repeated cross-creator evidence, at least three creators, at least two breakout creators, three normalized-performance samples, median normalized performance at least `1.1`, and no high concentration or closed entry window.
- `TEST`: positive but incomplete evidence, including accelerating/growing candidate patterns with strong fit, winning patterns with moderate fit, top-fit stable patterns, or strong-fit medium-confidence patterns.
- `WATCH`: ambiguous or conflicting evidence, including a winning pattern that is diluting, or evidence that is useful but not ready for active testing.
- `DEPRIORITIZE`: winning/declining evidence, weak relative performance, or a strong-fit pattern whose normalized median is below baseline.
- `AVOID`: only strong negative evidence: weak niche fit + declining trend + supported weak performance/breakout and at least medium confidence. It is never inferred from missing data.
- `INSUFFICIENT`: missing pattern history, missing niche fit, insufficient pattern status, or insufficient trend. This means “we do not know,” not “avoid.”

Opportunity gates are applied after role selection. `INSUFFICIENT` removes primary allocation and marks the strategy research-only. `CAUTION` permits at most one primary and keeps bounded tests. `TEST` stays validation-oriented. `RECOMMENDED` permits the evidence-backed portfolio. `AVOID` blocks optimistic entry strategy and never overrides the canonical Opportunity Engine.

## Evidence and calibration

All new thresholds are centralized in `CONTENT_STRATEGY_CONFIG` and marked `CALIBRATION_REQUIRED`: primary confidence, creator breadth, breakout breadth, performance samples, median performance, concentration, primary count and experiment sample size. The engine only uses public metadata and existing normalized creator-baseline evidence. CTR, retention, traffic sources, RPM, revenue, production cost and publishing cadence remain unavailable.

The experiment plan uses semantic priorities and a minimum eligible Long-form sample count. Success checks use normalized creator performance, breakout rate, repeatability and creator breadth; failure requires persistent underperformance after the eligible sample threshold, not a single video.

## Provenance

Every selected pattern retains its canonical Pattern ID and the pattern status, trend, fit, repeatability, creator breadth, breakout evidence, normalized performance, reasons, risks and blockers. The top-level provenance records opportunity decision/window, pattern IDs, current/comparison windows, historical semantics, algorithm versions and calibration state.

## Validation

`tests/content-strategy.test.mjs` covers clear primary, candidate test, dilution, weak fit, declining evidence, insufficient evidence, all five opportunity decisions, deterministic replay and Shorts isolation. The existing P0/P1/P2 suites remain the regression gate.

