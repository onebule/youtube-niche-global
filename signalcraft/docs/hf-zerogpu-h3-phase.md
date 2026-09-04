# Hugging Face ZeroGPU H3 adapter

This phase adds one provider (`HF_ZEROGPU_H3`) to the existing Compute Broker.
It is an experimental community/public compute dependency, not a production
SLA. Its cost class is `FREE_QUOTA`; a zero-dollar estimate does not mean an
unlimited quota, and the expected daily minutes remain an external policy
signal that requires calibration.

## Reuse / extend / create boundary

- Reuse: the existing `VideoComputeProvider`, Compute Broker routing, in-memory
  job store, server-side environment configuration, and output validation
  boundary.
- Extend: provider type/cost metadata, default provider registration, and the
  `.env.example` deployment contract. The provider is disabled by default, so
  existing routing is unchanged until explicitly enabled.
- Create: `src/lib/compute-broker/hf-zerogpu/`, the isolated Python
  `gradio_client` bridge, MP4 storage adapter, dynamic schema discovery, and
  `hf-h3:check` / `hf-h3:smoke` commands.
- Do not touch: Shorts, Long-form business logic, Canvas, radar, diagnosis,
  rankings, existing Modal code, or paid provider fallback behavior.

## Safety gates

`HF_TOKEN` is read only by server-side code and is sent to the bridge through
its private stdin. It is never returned in a report or written to browser
storage. `hf-h3:check` calls only `Client.view_api()` and Hub metadata. Real
generation requires both `HF_ZEROGPU_H3_ENABLED=true` and
`ALLOW_HF_ZEROGPU_REAL_GENERATION=true`, plus a calibrated wait bound. The
smoke command submits exactly one T2V request, with no retry, batch, Canvas
handoff, or paid fallback. It only reports success when an MP4 asset is
returned.

If authentication, Space availability, quota, or the discovered API contract
cannot be verified, the result remains blocked and does not simulate a model
or claim a successful generation.
