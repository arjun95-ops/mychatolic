# Radar + Comments Hotfix Apply Runbook

Date: February 20, 2026
Target: Supabase SQL Editor (production/staging)

## Scope
- Radar parity: invite RPC sync, radar comments, radar comment likes.
- Feed comments parity: threading, image field, comment likes, canonical policies, likes summary RPC.

## Execute Order (Recommended)
Run each file in order below.

1. `db/radar_invite_sync_hotfix.sql`
2. `db/radar_rpc_sync_hotfix.sql`
3. `db/radar_comments_hotfix.sql`
4. `db/comments_threading_hotfix.sql`
5. `db/comments_thread_integrity_hotfix.sql`
6. `db/comments_image_hotfix.sql`
7. `db/comments_likes_hotfix.sql`
8. `db/comments_like_summary_rpc_hotfix.sql`
9. `db/comments_policies_canonical_hotfix.sql`

Notes:
- All files above are idempotent-safe for rerun.
- `radar_rpc_sync_hotfix.sql` uses `begin/commit`; keep script intact.
- `radar_comments_hotfix.sql` uses `begin/commit`; keep script intact.

## SQL Audit (After Apply)
Run these audit scripts in SQL Editor:

1. `db/radar_phase3_audit.sql`
2. `db/comments_phase3_audit.sql`
3. `db/rls_sync_audit.sql`

Expected:
- Final `production_ready` in radar audit = `true`.
- Final `production_ready` in comments audit = `true`.
- No critical missing table/function/policy in RLS sync audit.

## App-Level Smoke Validation
From project root:

```bash
npm run verify:sync
npm run audit:smoke
npm run audit:smoke:write
npm run audit:smoke:radar
npm run audit:smoke:radar:invite
npm run build
```

Atau jalankan satu perintah gabungan:

```bash
npm run audit:release:radar
```

Expected:
- All commands exit successfully.
- RLS warnings for anon/non-authenticated probes may appear in readonly checks and are acceptable if authenticated checks pass.

## Rollback Guidance
- Prefer forward-fix rollback (apply corrective SQL) instead of destructive drop/reset.
- Keep query history and output snapshots from SQL Editor for each executed file.
