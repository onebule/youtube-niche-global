# P4 Phase 4.5C — Execution readiness

The Long-form provider panel now labels the access boundary explicitly. It
does not claim that a verified APIMart contract is an enabled model, and it
does not render a generic generation button while all models are blocked.

The backend remains the source of truth for Team access, provider
authentication, model enablement and execution permission. AUTO routing can
only select an executable model; with the current disabled catalog it returns
no executable recommendation. Manual selection cannot override the backend
gate, and no page load, route computation or selector change submits a job.

The future sandbox policy is one manually confirmed job, no automatic retry,
no provider fallback and no automatic credit consumption. The safe fixture is
kept as metadata only and has not been submitted.
