# P4 Phase 1 — Storyboard & Shot Planning Intelligence

## Scope

This is a Long-form-only layer. It consumes the P3.5 `ScriptDraft` and, when
available, the P3.4 `ScriptDevelopmentPackage`. Shorts, Rankings, Discover,
Radar, Opportunity, Pattern, Strategy, Validation, P3.1–P3.5 and Canvas are
not changed. No image/video prompt, model call, audio plan or Canvas node is
created.

## Pipeline

`ScriptDraft → SemanticScene → StoryboardScene → ShotRequirement → AssetRequirement / EvidenceVisualization → Readiness`

## Data availability audit

| Input | State in P4.1 | Boundary |
|---|---|---|
| Script sections, narration and claim registry | AVAILABLE | inherited from P3.5 |
| P3.4 semantic/visual requirements | DERIVABLE | joined by architecture section ID when present |
| Evidence registry | PARTIAL | public evidence can be linked; missing evidence stays unknown/research-required |
| Characters, locations and props | DERIVABLE | semantic requirements only; no visual understanding claimed |
| Thumbnails, URLs, source clips and screenshots | REQUIRES_ASSET | URLs are not treated as visual understanding; authenticated screenshots are never fabricated |
| Transcript / visual embeddings | REQUIRES_VISION | no phrase-level or frame-level claim is made |
| Charts and quantitative data | REQUIRES_RESEARCH unless linked evidence exists | no invented values |
| Archive / stock footage | REQUIRES_RIGHTS_REVIEW | no legal clearance is claimed |
| Canvas assets / generated media | UNAVAILABLE | P4.1 does not connect to Canvas or a model |

## Domain

`Storyboard` fields: `storyboardId`, `storyboardVersion`, `scriptId`,
`scenes`, `continuity`, `assetRequirements`, `evidenceVisualizations`,
`illustrativeVisuals`, `dataAvailability`, `productionFeasibility`, `confidence`, `reasons`,
`risks`, `blockers`, `readiness`, `provenance`.

`SemanticScene` fields: source section/beat IDs, purpose, visual objective,
information/evidence requirements, character/environment/object/graphic
requirements, continuity requirements, visual mode, shot-count and duration
ranges, visual density, complexity, confidence, risks and provenance.

`ShotRequirement` fields: purpose, subject/environment/action/composition,
continuity and evidence requirements, semantic visual mode, calibrated duration
range, production source, confidence and risks. It is not prompt wording.

Purposes implemented: `HOOK_VISUAL`, `CONTEXT`, `EXPLANATION`, `EVIDENCE`,
`COMPARISON`, `EXPERIMENT`, `TRANSITION`, `ESCALATION`, `PAYOFF`,
`CONCLUSION`.

Visual modes implemented: `LIVE_ACTION`, `BROLL`, `ARCHIVE`, `SCREEN_CAPTURE`,
`DIAGRAM`, `CHART`, `TEXT_GRAPHIC`, `AI_GENERATED_VISUAL`,
`NARRATION_ONLY`, `UNKNOWN` (plus the model-independent enum extensions).

Production sources: `CREATOR_CAPTURE`, `EXISTING_ASSET`, `PUBLIC_EVIDENCE`,
`LICENSED_STOCK`, `USER_PROVIDED`, `AI_GENERATABLE`, `REQUIRES_RESEARCH`,
`UNKNOWN`.

## Segmentation and continuity

A scene is split only when independent visual responsibilities, evidence units,
actions, environments or information units materially change. A simple
explanation remains one scene; complex multi-purpose requirements are split and
flagged. Every scene points to its source script section and (when present)
architecture narration beats. Shots always have a purpose.

Recurring primary characters, environments and key props use stable IDs and
one deduplicated asset requirement. Temporal relations use explicit relative
states such as `TIME_SHIFT`; exact dates are not inferred. Illustration B-roll
is stored in `illustrativeVisuals` with `ILLUSTRATIVE_VISUAL`, separate from
Claim-linked `evidenceVisualizations` with `EVIDENCE_VISUAL`.

## Readiness and safety

Readiness states: `READY_FOR_PRODUCTION_PLANNING`, `READY_WITH_CAUTION`,
`NEEDS_REVISION`, `BLOCKED`, `INSUFFICIENT`. A blocked script stays blocked;
missing assets, rights review, unavailable evidence, and calibration gaps do
not become silently available. Quantitative claims can request a chart only
when real evidence is linked; otherwise the visual mode is `UNKNOWN`.

Feasibility states: `FEASIBLE`, `FEASIBLE_WITH_RISK`, `REQUIRES_ASSET`,
`REQUIRES_RESEARCH`, `RIGHTS_REVIEW_REQUIRED`, `UNKNOWN`, `BLOCKED`.

Deterministic reason codes include `STORYBOARD_SCRIPT_READY`,
`STORYBOARD_SCENE_STRUCTURE_COMPLETE`, `STORYBOARD_EVIDENCE_VISUAL_SUPPORTED`,
`STORYBOARD_ASSET_REQUIRED`, `STORYBOARD_RIGHTS_REVIEW_REQUIRED` and
`STORYBOARD_CALIBRATION_REQUIRED`. Risks include asset availability, rights,
visual evidence, scene overload, continuity, feasibility, validation and
semantic-visual-understanding limits. Blockers include `SCRIPT_BLOCKED` and
`VISUAL_SCRIPT_CONTRADICTION` where detected.

All planning thresholds are centralized in `STORYBOARD_PLANNING_CONFIG` and
marked `CALIBRATION_REQUIRED`: maximum visual responsibilities (3), maximum
recommended shots (3), default shot duration (3–12 seconds), repetition (3),
and evidence coverage (0.7). These are not performance or production scores.

## Provenance and replay

Provenance carries Script, architecture, Creative Development, Brief, Idea,
Pattern, Strategy, Opportunity, evidence IDs, algorithm versions, snapshot and
timestamps. `storyboard-planning-v1` is separate from P3.4/P3.5 versions.
Identical Script Draft + inputs produce identical scene IDs, shot IDs, modes,
asset IDs, evidence links, continuity, readiness, confidence and provenance.

## Minimal product surface

Long-form opportunity cards now show a compact **P4 PHASE 1 · STORYBOARD
PLANNING** panel: readiness, confidence, scene/shot/asset/evidence counts,
rights-review count, first scene summaries, feasibility and calibration note.
It is intentionally not a page redesign.

## Fixture coverage

`tests/storyboard-planning.test.mjs` covers ready/caution/revision/blocked
scripts, simple vs complex segmentation, supported and unavailable evidence,
illustrative B-roll separation, chart-without-data protection, recurring
character/environment/prop deduplication, temporal shift, archive rights,
AI-generatable semantic requirements, deterministic replay and Canvas/prompt
isolation.

The deterministic fixture outputs are: ready script →
`READY_FOR_PRODUCTION_PLANNING`; caution script → `READY_WITH_CAUTION`; needs
revision → `NEEDS_REVISION`; blocked script / known rights blocker → blocked
Storyboard; simple explanation → one scene; multi-purpose section → multiple
scenes; supported quantitative claim → `CHART` evidence visualization; missing
chart data → `UNKNOWN` (no invented chart); unavailable claim → `UNKNOWN` with
`REQUIRES_RESEARCH`/`UNAVAILABLE`; illustrative B-roll → separate
`ILLUSTRATIVE_VISUAL`; recurring character/location/prop → one stable asset per
type; temporal wording → `TIME_SHIFT`; archive → `RIGHTS_REVIEW_REQUIRED`;
AI-generatable visual → semantic `AI_GENERATABLE` asset and no prompt.

## Product impact

Only Long-form opportunities gain `storyboardIntelligence`. Existing fields are
additive and the new report is computed after P3.5. Shorts behavior and query
results remain unchanged; Canvas and all model integrations remain untouched.

## Next phase (not implemented)

P4 Phase 2 — Visual Asset & Reference Intelligence: reference selection,
character/environment/prop packs, evidence assets and reusable asset provenance.
