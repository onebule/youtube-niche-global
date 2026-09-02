# P4 Phase 4.5 — Provider Schema Verification & Capability Grounding

## Actual topology

The browser uses the repository route `src/app/api/video/[...path]/route.ts`, which forwards to the internal video gateway `https://youtube-niche-global-api.vercel.app/api/video`. This is an `INTERNAL_PROXY` boundary. The read-only `GET /models` response identifies the configured request model IDs as `minimax-h3`, `seedance-2`, and `seedance-2-5`; all three currently return `enabled: false` with a Team-only access reason.

The repository does not contain the downstream MiniMax or Seedance submission, polling, output, or provider-error schemas. Direct-provider documentation would not prove the gateway contract, so no downstream capability is promoted to `VERIFIED`.

## Contract states

`VIDEO_GATEWAY_CONTRACT` records the repository wrapper paths, forwarding authentication boundary, client-visible envelopes, canonical status names and the explicit gaps. The model contracts preserve the exact gateway model IDs and mark model existence as `CONFIGURED`, availability as `DISABLED`, and all multimodal capabilities as `UNKNOWN`.

Execution readiness for every registered model is `NEEDS_SCHEMA_VERIFICATION`. P4.4 routing therefore remains conservative: disabled models are not auto-selected, and unknown hard capabilities cannot become compatible by assumption.

## What is and is not verified

- Verified/configured: internal proxy path, read-only model discovery endpoint, exact configured model IDs, client-side bearer-forwarding boundary, repository request/response type envelopes.
- Not verified: direct-vs-gateway downstream provider identity, provider request fields, provider task ID, provider polling status values, output URL/asset semantics, expiration, reference limits, START/END semantics, duration, aspect ratio, resolution, negative-prompt field, provider error codes and retry behavior.
- No credentials are stored in contracts or fixtures. No live generation submission or polling was performed.

## Adapter state

MiniMax and Seedance remain `BOUNDARY_ONLY` / `NEEDS_SCHEMA_VERIFICATION`. The existing P4.4 canonical serializer is not relabeled as a verified third-party payload. Transport is intentionally absent; a future phase may add a server-side transport after a real gateway contract is supplied.

## Verification coverage

The report exposes counts of `VERIFIED`, `CONFIGURED`, `UNVERIFIED`, `UNKNOWN` and `UNSUPPORTED` capability entries. It is a coverage report, not a score. Price, quality, speed and model success rate remain `UNKNOWN`.

## Validation

Sanitized deterministic tests cover topology discovery, exact IDs, disabled availability, unknown capability preservation, execution-readiness blocking, strict report normalization, secret boundaries, P4.4 compatibility reuse, fallback, serialization loss and non-generative route isolation.
