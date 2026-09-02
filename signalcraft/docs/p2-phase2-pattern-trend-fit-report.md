# P2 Phase 2 — Pattern Trend & Niche-Pattern Fit

Status: implemented locally; threshold policy remains `CALIBRATION_REQUIRED`.

## Boundary

This phase consumes the canonical Long-form P2 Phase 1 Pattern ID and report.
It does not alter the Shorts pipeline, the niche lifecycle engine, the unified
opportunity decision, or any strategy/idea/Canvas flow.

## Evidence model

`current window → previous comparable window → same Pattern ID metrics →
Pattern Trend`.

The report keeps adoption, creator breadth, normalized median/P75 performance,
breakout rate and creator concentration as separate deltas. It only compares
windows with the same time semantics and equal verified duration. Missing
history, incomparable dates, and absent metrics remain `INSUFFICIENT`.

Trend states are `ACCELERATING`, `GROWING`, `STABLE`, `DILUTING`, `DECLINING`
and `INSUFFICIENT`. Acceleration requires several improving dimensions; rising
adoption with weakening performance or breakout rate is explicitly `DILUTING`.
The engine never creates a generic Pattern Trend score.

## Niche-Pattern Fit

For an explicitly supplied target niche, the engine compares the same Pattern ID
inside the niche with Long-form samples outside the niche. It exposes inside /
outside videos, creators, normalized performance, breakout rate and
repeatability, then classifies `TOP_FIT`, `STRONG_FIT`, `MODERATE_FIT`,
`WEAK_FIT` or `INSUFFICIENT`. The result is evidence for later selection, not a
strategy recommendation. Niche opportunity/lifecycle/entry-window context is
carried as context only and does not rewrite those engines.

## Product surface

Long-form opportunity cards now show a compact `P2 PHASE 2 · PATTERN TREND`
panel. With only representative videos, the panel correctly says that history
is insufficient. When a future upstream response supplies comparable windows,
it will show adoption, creator, performance and breakout changes plus niche-fit
labels. It never generates ideas or connects to Canvas.

## Verification

`tests/content-pattern-trends.test.mjs` covers missing history, comparable
acceleration, dilution, niche fit, incomparable semantics and Shorts isolation.
The existing P2 Phase 1 and P0/P1 regression suites remain unchanged.
