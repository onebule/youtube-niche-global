# P1 Phase 1 — Creator Baseline & Breakout Intelligence

## 1. Repository State

- Starting HEAD: `709dffe` (`Implement P0 phase 3 decision boundaries`)
- Ending HEAD: recorded by the final commit; verify with `git rev-parse HEAD`
- Branch: `main`
- Push status: not claimed until the commit is created and the remote push is verified
- Preserved unrelated user-owned files: `pnpm-workspace.yaml`, `tsconfig.tsbuildinfo`

## 2. Data Availability Findings

| Input | Status | Finding |
| --- | --- | --- |
| Video ID, channel ID, title | AVAILABLE | Present in the canonical `Video` shape and channel-doctor response. |
| Publish time, duration, content format | AVAILABLE | Public metadata is carried through `DiagnosticVideo`; format remains explicit. |
| Current public views | AVAILABLE | Used only when finite and non-negative. |
| Capture time / repeated snapshots | PARTIAL | `Video.snapshots` supports this, but the public channel-doctor response currently supplies current video rows rather than a guaranteed snapshot series. |
| Channel video history | PARTIAL | The diagnostic request is bounded by a requested limit; it is not silently treated as a complete channel history. |
| Subscribers | AVAILABLE/PARTIAL | Channel-level public count is available when published; missing values remain unknown and are not used as a baseline substitute. |
| Video age | DERIVABLE | Derived from publish time and the capture/analysis time. |
| View velocity | DERIVABLE/PARTIAL | Derived as views per day from public views and age; exact recorded velocity is available only when repeated snapshots exist. |

Because live channel-doctor data does not guarantee a complete repeated-snapshot history, the implementation uses a clearly labelled retrospective age-normalized metric and returns `INSUFFICIENT` when comparable history is too thin.

## 3. Creator Baseline Architecture

`src/lib/creator-breakout.ts` filters the same creator and exact content format, deduplicates IDs, excludes the target, limits the recent lookback, and rejects invalid dates/views. Performance is `views_per_day`, derived from a valid latest public snapshot when present, otherwise from current public views and publish age. The baseline requires five comparable videos, uses median, P25, P75 and MAD, and exposes a MAD/median dispersion ratio. A single-target assessment avoids later videos; the creator-level repeatability summary is explicitly retrospective and may use the current corpus to estimate repeatability. No baseline is silently replaced with a peer or global average.

## 4. Breakout Architecture

Expected performance is the verified creator median for the same format. Breakout multiple is `actual views/day ÷ expected views/day`, rounded to one decimal below 10× and to an integer at larger scale. Zero/invalid expected values produce no ratio. Classification is centralized (`NORMAL`, `ABOVE_BASELINE`, `BREAKOUT`, `STRONG_BREAKOUT`, `EXTREME_BREAKOUT`, `INSUFFICIENT`) and confidence is canonical (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`). Breakout evidence is not mapped to `EntryDecision`.

## 5. Repeat Breakout

The summary exposes eligible videos, breakout and strong-breakout counts, rate, recent breakout count, median/max multiple, and `NONE`, `ONE_OFF`, `REPEATED`, or `INSUFFICIENT`. `REPEATED` requires at least five eligible videos and two breakout videos. One breakout with enough eligible history is `ONE_OFF`; fewer than five eligible videos is always `INSUFFICIENT`.

## 6. Thresholds

All thresholds live in `CREATOR_BREAKOUT_CONFIG`:

| Threshold | Value | Calibration |
| --- | ---: | --- |
| Minimum baseline videos | 5 | PROVISIONAL |
| Recent lookback | 20 videos | PROVISIONAL |
| Maximum baseline age | 730 days | PROVISIONAL |
| Above-baseline | 1.5× | PROVISIONAL |
| Breakout | 3× | PROVISIONAL |
| Strong breakout | 8× | PROVISIONAL |
| Extreme breakout | 15× | PROVISIONAL |
| Repeat minimum eligible | 5 | PROVISIONAL |
| Repeat minimum breakouts | 2 | PROVISIONAL |
| High-variance MAD/median | 0.75 | PROVISIONAL |

The repository has deterministic fixtures but no representative production distribution export, so the engine reports `CALIBRATION_REQUIRED` rather than presenting these as scientifically final thresholds.

## 7. Files Changed

| Path | Purpose | Behavior change |
| --- | --- | --- |
| `src/lib/creator-breakout.ts` | Pure creator baseline, breakout and repeatability engine | Adds isolated evidence calculations; no ranking or entry decision changes. |
| `src/lib/channel-diagnostic-engine.ts` | Long-form-only integration | Adds optional creator breakout evidence to Long-form diagnosis; Shorts path is untouched. |
| `src/app/channel-doctor.tsx` | Progressive display of Long-form evidence | Shows baseline/repeatability context only when the Long-form diagnosis has evidence. |
| `src/app/doctor.css` | Evidence card styling | Adds a small non-scoring evidence block. |
| `tests/creator-breakout.test.mjs` | Ten deterministic cases plus replay | Covers the required edge cases. |
| `tests/channel-diagnostic-engine.test.mjs` | Format isolation regression | Verifies Shorts has no new creator-breakout field. |
| `tests/p0-phase3-replay-fixtures.test.mjs` | Replay extension | Verifies stable Long-form creator evidence across replay. |

## 8. Before / After

Fixture: six historical Long-form videos at 5M views/day-equivalent and a 6M target.

- BEFORE: `6M views → high-performing video`
- AFTER: `Creator median 5M/day; actual 6M/day; breakout 1.2×; classification NORMAL`

Fixture: six historical Long-form videos at 20K/day-equivalent and an 800K target.

- BEFORE: `800K views → high-performing video`
- AFTER: `Creator median 20K/day; actual 800K/day; breakout 40×; classification EXTREME_BREAKOUT; confidence LOW`

The viral-outlier fixture (`20K, 25K, 31K, 28K, 2.8M, 27K`) keeps a robust median near the normal cluster rather than allowing the outlier to define expected performance.

## 9. Regression

- Rankings: no code path or ordering changed.
- Discover: no code path or ordering changed.
- Radar: no code path or ordering changed.
- EntryDecision: no mapping from breakout to recommendation was added.
- Shorts: no new calculation is invoked for Shorts; existing scoring, counts, sorting, filters, history and response tests remain on the legacy path.

## 10. Validation Results

- TypeScript: passed (`tsc --noEmit`)
- Targeted creator/diagnostic/replay tests: passed (26 tests across the focused files)
- Full test suite: passed (95 tests)
- Shorts regression: passed through existing scoring, radar, response and channel-diagnostic tests
- ESLint: passed with 0 errors and 23 pre-existing warnings
- Next build: passed on Next.js 16.2.6 (Turbopack)
- `git diff --check`: passed

## 11. Remaining Risks

- The public channel-doctor endpoint does not guarantee complete repeated snapshots, so live results can remain `INSUFFICIENT` even when a channel visibly has more videos elsewhere.
- The baseline is retrospective when only current public metadata is available; it is not a reconstructed publish-time forecast.
- Thresholds are intentionally provisional until a representative production distribution is available.

## 12. P1 Phase 1 Completion Assessment

`P1 PHASE 1 COMPLETE`. The implementation meets the repository-level functional requirements: sufficient evidence gates, format isolation, robust statistics, leakage protection, explicit retrospective semantics, safe breakout math, canonical confidence, repeatability semantics, deterministic replay, and Shorts regression preservation.

## 13. Recommended Next Phase

If the completion gates remain green, the next bounded phase is **P1 Phase 2 — Small Creator Breakout & Niche-Level Opportunity Signals**. It may aggregate the evidence above into small-creator breakout rate, repeated cross-channel breakouts, concentration and breakout density. It is not implemented here.
