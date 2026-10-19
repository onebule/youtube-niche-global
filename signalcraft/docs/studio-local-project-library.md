# SignalCraft Studio parity — Local project library

Status: isolated Draft PR only. This is a Graph v1-compatible browser project library, **not** the production Studio, cloud workspaces, or RunningHub 1:1 completion.

## Features

- Up to 40 independent projects in the existing Studio parity preview, controlled by the Graph v1 normalizer's current storage cap.
- Create, rename, select, delete (explicit confirmation; last project protected), and duplicate a project as a safe structure template.
- Preserve all original projects when switching. Undo/redo histories and selection/Agent proposals are reset on switching to prevent cross-project modifications.
- Persist the entire version-1 workspace, including the selected project's ID, instead of overwriting storage with only the active project.
- New "export all projects" JSON button backs up the full structure. This backup may contain prompt text and opaque asset IDs but not the private media bytes. Users should keep exported files private.
- New "import workspace" file input imports all projects in a Graph v1 JSON file as additional templates without overwriting existing projects. Files limited to 5 MiB; total workspace limited to 40 projects. Any validation/capacity failure aborts before a single project changes.
- For duplicated or imported templates: remap retained node/edge IDs; preserve project text, storyboard prompts, scene layout and valid template connections; clear every asset ID, output, provider job history and text result; **exclude video-result nodes and associated edges**. Invalid/dangling source edges cause the entire copy/import to fail, not silent data loss.
- Existing per-project Mock journals remain isolated; switching restores only a compatible journal for that project. A deleted project has only its own scoped Mock journal removed.
- Anonymous data lives in sessionStorage for the current browser tab; authenticated account data uses the existing account-scoped localStorage key. No cross-device synchronization, server storage or paid calls are added.

## Guardrails and remaining work

- The older single-project Graph v1 saved format is still supported, and pre-existing project structures should survive upgrades. User files are never written to production databases.
- LocalStorage is not a transactional, tamperproof store. Multiple browser tabs can compete; this does **not** meet a cloud workspaces multi-tenant durability standard.
- Import is deliberately **structural**, not a restoration of media rights or paid-generation outputs; a real cloud asset library needs authenticated ownership checks and separate migration approval.
- Deletion of a local project is not added to single-project undo/redo. Use full-workspace export before deleting important drafts.
- A browser-generated preview is not enough to declare pixel-perfect RunningHub parity. Desktop/mobile screenshot comparison and permitted authenticated UI reference are still pending.
- RC-2 local Windows source, live deployment SHA, production DB schema and actual billing gates still require reconciliation before release. Do not merge/deploy without explicit approval.

## Validation

Dedicated tests: tests/studio-project-workspace.test.mjs. They cover CRUD immutability, template remapping, ownership-sensitive media cleanup, Graph v1 normalization, collision/capacity limits, atomic bulk imports and malformed graph rejection.

Headless Chrome E2E now checks project create/switch, duplicate/rename/delete, full-workspace export, bulk JSON import, account-scoped Mock isolation and refresh persistence. Final pass is contingent on the GitHub Actions workflow's focused suite, full suite, typecheck, production build, HTTP 404/200 gates and Chrome job.
