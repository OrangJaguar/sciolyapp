# Supabase setup

Use **[`BEFORE_PLAN_03.md`](./BEFORE_PLAN_03.md)** for first-time auth/env.

**Migrations (in order, Role: `postgres`):**

| File | When |
|---|---|
| `000_wipe_public_schema.sql` | Only if public schema is half-broken |
| `20260803_initial.sql` | Fresh project spine (`SCIOLY-0803C-NO-SEMI`) |
| `20260804_addons.sql` | Fresh project only — all Plans 03–17 addons (`SCIOLY-0804-ADDONS`) |
| Newer `20260804_*.sql` / dated files | Only the **new** plan’s paste when listed |

If your live DB already ran the old split Plan 03–17 files, **do not** re-run `20260804_addons.sql`.
