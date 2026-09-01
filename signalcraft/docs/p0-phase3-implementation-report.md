# P0 Phase 3 implementation report — Product boundary and decision presentation

Date: 2026-09-01  
Scope: `youtube-niche-global/signalcraft`  
Baseline: Phase 2 correction commit `caf4ae4`

## Repository state

Phase 3 is implemented on top of the verified Phase 2 baseline. The working
tree changes are additive and are limited to the research desk, shared
evidence transport, navigation semantics, and deterministic tests. The
untracked user files `pnpm-workspace.yaml` and `tsconfig.tsbuildinfo` were not
modified or staged.

## Product boundary

The desk now presents four distinct jobs without changing legacy routes:

| Surface | Answers | Does not answer |
| --- | --- | --- |
| Rankings | Which public videos/channels currently rank by the selected legacy dimension? | Whether a niche is worth entering |
| Discover | Which individual public videos are worth inspecting? | A cross-channel trend event or entry decision |
| Long-form Trend Radar | What changed recently in long-form supply, demand proxies, or creator spread? | Durable niche value or a production recommendation |
| Long-form Niche Evaluation | Is this direction worth testing or entering over time? | A claim about private CTR, retention, RPM, or revenue |

The long-form Radar labels now say “变化信号 / CHANGE SIGNAL” rather than
“机会信号”, and its copy explicitly points to evaluation for durable entry
decisions. The existing Shorts Radar remains a separate engine and keeps its
existing labels and business path.

## Decision presentation

Long-form evaluation continues to show Market Opportunity and Execution Fit as
upstream/opaque context. It now presents Performance and Entry Decision as
separate, inspectable fields. Entry status is gated by evidence quality,
sample/channel coverage, baseline status, representative proof, and supported
public metrics; a high upstream score cannot bypass an insufficient evidence
gate. Evidence facts, inferences, missing fields, capture time, snapshot IDs,
and upstream algorithm metadata remain visible through the canonical transport
contract.

## URL state and navigation

Long-form Radar and Evaluation persist meaningful view controls in the URL:
market, time window, lane, focus topic, and selected direction. The shared
`research-url-state` helper round-trips these controls without serializing
workspace data. Switching research jobs preserves the current query so a user
does not silently lose their selected scope. Header and Studio navigation now
use real links with application routing on ordinary primary clicks while
preserving middle-click, modifier-click, copy-link, and new-tab behavior.

## Observability

The additive evidence contract now accepts `inputSnapshotId` and structured
upstream `decisionReasons` in addition to algorithm version, snapshot ID,
request ID, source, and capture time. Malformed fields are dropped rather than
invented. No local request ID is synthesized when the upstream/API boundary
does not provide one.

## Hooks and safe UI fixes

The remaining two Hooks lint errors were removed without disabling lint rules:

- thumbnail readiness is derived from loaded/failed source state instead of a
  synchronous state update inside an effect;
- persisted account hydration schedules its state transition after effect
  setup and cleans up the timer.

The video thumbnail is now a semantic button rather than a `div` with a fake
link role. These changes do not alter Shorts scoring or data selection.

## Replay fixtures and regression coverage

`tests/p0-phase3-replay-fixtures.test.mjs` adds deterministic fixtures for:

- long-form count/order replay, decision enrichment, and upstream observability;
- Radar count/order replay and explicit Shorts payload preservation;
- URL-state round trips and removal of focused state;
- malformed decision-reason rejection.

The existing Shorts regression fixture remains in
`tests/evidence-data-quality.test.mjs` and verifies the legacy calculation,
including score parity and confidence behavior.

## Files changed

- `src/app/signalcraft-app.tsx`
- `src/app/longform-research-desk.tsx`
- `src/app/longform-opportunities.tsx`
- `src/app/opportunity-radar.tsx`
- `src/app/globals.css`, `polish.css`, `red-theme.css`, `research-desk.css`
- `src/lib/research-url-state.ts`
- `src/lib/evidence-contract.ts`
- `src/lib/longform.ts`, `longform-response.ts`
- `src/lib/opportunity-radar.ts`, `shortform-opportunity-radar.ts`
- `tests/p0-phase3-replay-fixtures.test.mjs`

## Shorts regression

The full automated suite includes the pre-existing Shorts scoring and
normalization assertions. No Shorts collector, filter, ranking, historical
query, database field meaning, UI card, or API business rule was changed. The
only shared changes are additive transport fields and navigation semantics.

## Validation evidence

- TypeScript: passed (`tsc --noEmit --pretty false`).
- Test suite: **83 passed, 0 failed**.
- Next production build: passed on Next.js 16.2.6.
- Targeted ESLint for all Phase 3 files: 0 errors, 13 existing warnings
  (mostly `no-img-element`; no new Hooks errors).
- `git diff --check`: passed.
- Production/Vercel deployment and authenticated browser acceptance were not
  performed in this local change and are not claimed here.

## P0 completion and risks

The repository-level P0 Phase 3 acceptance criteria are complete: boundaries
are explicit, entry decisions are separated from Radar change signals, URL
state is replayable for the long-form desk, upstream observability is
preserved, navigation is semantically correct, and deterministic fixtures
cover the compatibility boundary.

Remaining P0 operational risk is external: production deployment, live API
credentials/quotas, and authenticated browser acceptance still need to be
verified in the target environment. No P1 Creator Baseline work is started by
this change.
