# Supabase setup

1. Create a Supabase project.
2. Copy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into `.env.local` (see `.env.example`).
3. Auth: disable **Confirm email** for local dev; set Site URL + redirect to `http://localhost:5173`.
4. Schema is already applied on the linked project. For a fresh DB, use Supabase dashboard backups or your own SQL export.

**Edge functions** (deploy from repo root):

```bash
supabase functions deploy generate-worker
supabase functions deploy critic-worker
supabase functions deploy binder-audit
```

Set secrets in Supabase → Edge Functions → Secrets (`NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_VISION_MODEL`, etc.).
