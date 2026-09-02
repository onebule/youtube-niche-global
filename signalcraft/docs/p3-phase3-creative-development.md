# P3 Phase 3 — Hook / Title / Outline Intelligence

## Scope

P3 Phase 3 is a Long-form-only layer. It consumes the P3.2 `CreativeBrief` and produces a deterministic `CreativeDevelopmentPackage`. It stops before final title copy, exact spoken hooks, scripts, storyboards, thumbnails, image/video prompts and Canvas hand-off.

## Data audit

| Input | Status | Boundary |
| --- | --- | --- |
| Creative Brief, Idea validation, Strategy role, Pattern/Fidelity, Content Promise, Core Mechanism, Differentiation | AVAILABLE | Reused from P3.2 and upstream P0–P2 contracts |
| Title structure and source titles | DERIVABLE | Reused through P3.1 Pattern IDs and Idea novelty lineage |
| Hook objective and opening promise | DERIVABLE | Derived from Brief, Pattern and Promise; not claimed as observed hook performance |
| Pattern-specific outline | DERIVABLE | Deterministic mapping for HOW_TO, QUESTION, COMPARISON, LIST_OR_NUMBER and STORY |
| Transcript, source opening hook, chapters, retention, CTR, AVD, RPM and revenue | UNAVAILABLE | No fabricated private metrics or transcript evidence |
| Semantic embeddings and visual opening analysis | REQUIRES_NEW_DATA / REQUIRES_VISION | v1 uses the auditable P3.1 lexical proxy and marks review risk |
| LLM wording | REQUIRES_LLM (optional) | Not used for eligibility, readiness, Pattern Fidelity or originality gates |

## Domains

`TitleDirection` records a supported structural type, angle, promise type, tension type, mandatory/prohibited elements, source Pattern and an originality gate. It is not a final title.

`HookIntelligence` records a Hook Objective, Hook Structure, Opening Promise, required/prohibited elements and evidence limits. It is not exact spoken copy.

`ContentOutline` records an outline architecture and structured beats. Each beat has a role, objective, information requirement, tension function, evidence requirement and transition purpose. It is not a script or storyboard.

`OriginalityGuardrails` permits reuse of the mechanism while blocking source surface copying. `TOO_SIMILAR`, `DUPLICATE` or a provisional surface-similarity breach blocks the package.

## Pattern mapping

- `HOW_TO` → `HOW_X` title direction, process tension, `EXPLAINER` outline.
- `QUESTION` → `WHY_X`, curiosity gap, `EXPLAINER` outline.
- `COMPARISON` → `COMPARISON`, trade-off tension, criteria → option A → option B → trade-off → conclusion.
- `LIST_OR_NUMBER` → `LIST`, selection promise, scope → items → synthesis → takeaway.
- `STORY` → `INVESTIGATION`, stakes, opening tension → context → escalation → turning point → resolution.
- Other or plain metadata → conservative `EXPLAINED` / `EXPLAINER` direction.

## Gates and readiness

Readiness states are `READY_FOR_SCRIPT_DEVELOPMENT`, `READY_WITH_CAUTION`, `NEEDS_REVISION`, `BLOCKED` and `INSUFFICIENT`.

- Rejected/blocked Briefs, `AVOID` strategy or entry decisions, and title-copy risks are `BLOCKED`.
- Missing evidence, absent Pattern identity or insufficient confidence is `INSUFFICIENT`.
- Pattern mismatch, promise mismatch or unresolved structural inconsistency is `NEEDS_REVISION`.
- Conditional validation, declining/diluting trend, production/IP dependency, missing transcript or lexical-only similarity is `READY_WITH_CAUTION`.
- Only a validated, aligned, Pattern-consistent Brief with complete promise coverage and no known gate is `READY_FOR_SCRIPT_DEVELOPMENT`.

All v1 thresholds are centralized in `CREATIVE_DEVELOPMENT_CONFIG` and marked `CALIBRATION_REQUIRED`.

## Provenance and isolation

Each package traces Brief/Idea/Pattern/Strategy/Opportunity versions, source Case IDs, snapshot and evaluation time. The response layer computes this only for Long-form opportunities. Shorts, Rankings, Discover, Radar, Opportunity Engine, canonical Pattern logic, P2 validation and Canvas code are not modified.

## Verification

`tests/creative-development.test.mjs` covers deterministic replay, strong and rejected Briefs, comparison structure, source-title clone blocking and same-Pattern/new-Idea allowance. Full project tests and production build remain required before deployment.
