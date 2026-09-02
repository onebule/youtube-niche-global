# P4 Phase 4.5B provider contract snapshot

Long-form provider verification now consumes grounded evidence from the local
`youtube-niche-global-api` backend. MiniMax H3 and Seedance 2/2.5 serialize to
APIMart through the server-only adapter; the browser still talks only to the
internal proxy.

The panel distinguishes:

- contract verified vs model enabled;
- internal generation ID vs provider task ID;
- provider task states vs the strict `UNKNOWN` fallback;
- private Supabase output asset vs an unclaimed permanent URL.

The execution gate remains `MODEL_DISABLED` for every configured Long-form
model until the existing Team/provider access decision is intentionally
changed. No Canvas, Shorts, Rankings, Discover, Radar, or Opportunity logic is
changed by this phase.
