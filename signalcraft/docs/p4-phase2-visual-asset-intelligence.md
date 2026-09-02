# P4 Phase 2 — Visual Asset & Reference Intelligence

## Status

`visual-asset-intelligence-v1` is implemented for the Long-form pipeline. It
consumes the P4.1 Storyboard/Shot Plan and creates a deterministic, traceable
asset package. Shorts, rankings, radar, Canvas and P4.1 data are not rewritten.

## Canonical flow

`Storyboard → Asset Requirements → Asset Identity → Availability → Reference
Packs → Continuity Locks → Rights/Provenance → AI Generation Eligibility →
Asset Package Readiness`

The registry keeps one canonical identity for recurring characters,
environments and props. Scene and shot manifests point to that identity and
retain missing-asset routes. Reference packs are versioned; description-only
packs remain incomplete. Evidence assets must retain a real source and are
never replaced by generated imagery. Chart data and chart render remain
separate, and screenshots require an actual capture.

Each package also exposes a typed dependency graph and a data-availability
audit (`AVAILABLE`, `DERIVABLE`, `REQUIRES_VISION`, `REQUIRES_ASSET`,
`REQUIRES_RESEARCH`, `REQUIRES_RIGHTS_REVIEW`, `REQUIRES_USER_INPUT`, or
`UNAVAILABLE`) so downstream work can distinguish a missing input from an
unsupported inference.

## Truth boundaries

- No image/video generation, prompt compilation, Canvas hand-off or provider
  calls happen in this phase.
- Public availability is not treated as a licence. Unknown, archive, stock and
  IP-dependent sources remain rights-review or licence-required.
- No visual similarity, embeddings, frame facts or screenshot facts are
  invented. Vision-dependent fields remain explicitly unavailable.
- `AI_GENERATABLE` means a possible later route only. Evidence assets are
  `NOT_RECOMMENDED`/`NOT_ELIGIBLE`; recurring identities require references.

## Integration

`normalizeLongformResponse` builds the visual asset report after P4.1 and
exposes it on `LongformOpportunity.visualAssetIntelligence`. The UI presents a
compact readiness summary and the first six canonical assets, while keeping
the full package machine-readable for the next phase.

## Verification

`tests/visual-asset-intelligence.test.mjs` covers null/blocked inputs,
recurring identity deduplication, reference pack completeness, screenshots,
evidence, chart separation, rights, AI eligibility, user-input gaps,
continuity locks, deterministic replay and Shorts/Canvas isolation.
