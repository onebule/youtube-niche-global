# Studio Runtime V2: Local Mock Checkpoints and Future Execution Gates

Status: experimental feature-gated branch, Draft PR, **DO NOT MERGE OR DEPLOY**.

## Implemented locally

1. studio-mock-checkpoint.ts stores a replayable MOCK_ONLY command journal. A saved task-status or success flag is never trusted on recovery. It replays through the pure studio-mock-runtime.ts state machine.
2. Journal operations: STEP, FINISH, RETRY, CANCEL. Each has a unique request ID and expected revision. Duplicate same-ID/same-action requests return the prior result without another state transition. A reused ID for a different action, stale revision or unsupported action fails closed.
3. Browsers save with a dedicated namespace: signalcraft-studio-parity-mock-journal-v1. Anonymous sessions use sessionStorage within one browser tab. Authenticated identities use account-scoped localStorage, within one browser profile.
4. Before restoring, check journal version, scope, graph change token, command order, uniqueness, size bounds and legal transitions. Invalid or stale logs cannot be resumed. No provider-generated media result is synthesized.
5. Browser writes the new journal synchronously *before* displaying the run transition. Storage failure does not advance the visible Mock state. The UI checks a previously saved revision to detect ordinary multi-tab conflicts.
6. User can export an audit JSON with Mock command history and reconstructed events and clear only the dedicated Mock key. Existing canvas drafts and original production workspaces remain unchanged.

## Precise limitations

- This is NOT server/cloud task persistence. Local session data can be lost and does not sync between devices.
- The graph token uses a non-cryptographic FNV-1a hash: change detection only, NEVER an authorization, tamper-proofing or billing gate.
- Browser localStorage offers no atomic compare-and-swap. The cross-tab revision check detects ordinary conflicts, but cannot guarantee race-free writes.
- All reconstructed results are simulated: providerCalls=0, paidJobs=0, generatedAssets=0. No real provider queue, webhook, polling endpoint, credit hold, SQL write or paid execution was added.
- The runtime can be recovered only with a compatible graph and the same storage scope. Editing the graph invalidates the prior run.

## Next phase requires explicit approval

Before connecting a real provider, the backend needs: authenticated user ownership; server-enforced model/price/capability preflight; transactionally unique (account_id,idempotency_key) submissions; immutable run/event records; signed provider callbacks; bounded leases/retries and cancellation; reconciliation of genuine provider receipts and asset provenance; and verified prevention of duplicate credit holds.

Production database migrations, paid tasks, credential changes, merges and deployments are outside this PR and require separate user permission. The actual Windows RC-2 worktree and deployed SHA must be reconciled before a merge. RunningHub 1:1 visual/functional parity still requires authenticated reference screens.

## Tests

studio-mock-checkpoint.test.mjs covers replay, deduplication, revision conflicts, account isolation, graph change detection, malicious/invalid stored payloads, paused recovery, retry and terminal cancellation. Chrome E2E must demonstrate paused and cancelled recovery across reload, and must inspect the absence of raw user prompts in the persisted Mock journal.

Only report PASS after GitHub Actions completes its unit, full-suite, TypeScript, Next build, HTTP-flag and Chrome E2E gates.
