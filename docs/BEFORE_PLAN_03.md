# Before Plan 03 — detailed Supabase walkthrough (Aug 3)

You already wiped successfully (no tables). Good. You do **not** need to wipe again unless this run fails halfway. No users were created last time — skip the “delete users” step.

---

## Why 0803 failed before

The SQL editor splits the script on every `;` character.  
Concept descriptions had sentences ending with `;` (e.g. “…into smaller particles…”). The editor cut the statement there, then tried to run leftover text and errored with:

`relation "smaller" does not exist`

**Fixed on disk.** If you still see that error, you re-ran an **old Untitled query** in the SQL Editor (browser buffer), not the updated file.

---

## Step 1 — Open the fixed migration file on your Mac

1. In Cursor, open:  
   `sciolyapp/supabase/migrations/20260803_initial.sql`
2. Confirm line 3 says: `PASTE-CHECK TOKEN: SCIOLY-0803C-NO-SEMI`  
   If that token is missing, you have the wrong file.
3. Select **all** text (Cmd+A) → Copy (Cmd+C)  
   File is long (~170KB / ~1000 lines). Copy the whole thing.

---

## Step 2 — Run it in Supabase (must be a NEW query)

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and open project **sciolyapp**.
2. Left sidebar → **SQL Editor**.
3. **Do not** re-use an existing “Untitled query.” Click **+ New query**.
4. Paste (Cmd+V). The **first lines** must include `SCIOLY-0803C-NO-SEMI`.  
   If you don’t see that token, stop — you pasted the wrong buffer.
5. Green **Run** (or Cmd+Enter). Wait several seconds.

If a previous failed run left half-created tables, run `000_wipe_public_schema.sql` first, then this migration.

### Success looks like
- Green / “Success”  
- Often **“No rows returned”** — that is OK for CREATE/INSERT  

### If it errors again
- Copy the **full** error text and paste it in chat  
- Do **not** re-run wipe unless tables are half-created  

---

## Step 3 — Verify tables and seed

1. Left sidebar → **Table Editor**.
2. You should see tables including:  
   `profiles`, `teams`, `taxonomy_events`, `taxonomy_topics`, `taxonomy_concepts`, `questions`, …
3. Click **taxonomy_events** → browse rows.  
   `studyable` = true only for `anatomy`, `chem_lab`, `water_quality`.
4. Optional — SQL Editor → New query → Run:

```sql
SELECT count(*) AS topics FROM taxonomy_topics;
SELECT count(*) AS concepts FROM taxonomy_concepts;
SELECT id, studyable FROM taxonomy_events WHERE studyable = true;
```

Expect: **topics ≈ 18**, **concepts ≈ 245**, three studyable ids.

---

## Step 4 — Auth settings (Email)

1. Left sidebar → **Authentication**.
2. Open **Sign In / Providers** (or **Providers**).
3. Click **Email**.
4. Ensure Email provider is **Enabled**.
5. Find **Confirm email** → turn it **OFF** (so local signup works without inbox).
6. Click **Save**.

Skip Google for now.

---

## Step 5 — Auth URL config (localhost)

1. Still under **Authentication**, open **URL Configuration** (sometimes under Auth settings).
2. **Site URL** set to exactly:
   ```
   http://localhost:5173
   ```
3. Under **Redirect URLs**, add:
   ```
   http://localhost:5173/**
   ```
4. **Save**.

Localhost is correct for laptop testing. Custom domain later.

---

## Step 6 — Local `.env.local` on your Mac

1. Supabase → gear **Project Settings** → **API**.
2. Copy:
   - **Project URL**
   - **anon public** key (not `service_role`)
3. In the project folder `sciolyapp` (same place as `package.json`):

```bash
cp .env.example .env.local
```

4. Edit `.env.local` so it looks like:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=paste_anon_key_here
```

5. Save the file.
6. In Terminal:

```bash
cd /Users/SANSG/Desktop/sciolyapp
# stop any old server with Ctrl+C if running
npm run dev
```

Vite only reads env vars on startup — restart after editing `.env.local`.

---

## Step 7 — Test signup

1. Browser → [http://localhost:5173/login?mode=signup](http://localhost:5173/login?mode=signup)
2. Click **SIGN UP** tab if needed.
3. Email + password (6+ chars) → **Create Account**.
4. You should land on **Setup** (handle → division → freelancer/join).
5. Finish → **Missions** HUD.
6. Click radar icon → **Profile** → **Sign Out** → sign in again.

---

## Ready for Plan 03 when

- [ ] `20260803_initial.sql` ran with Success  
- [ ] 18 topics / ~245 concepts / 3 studyable events  
- [ ] Email confirm off + localhost URLs saved  
- [ ] `.env.local` set and `npm run dev` restarted  
- [ ] Signup → setup → Missions works  

Then tell me: **signup works — start Plan 03**

---

## Do you need wipe again?

| Situation | Action |
|---|---|
| Tables still empty, never successfully ran 0803 | **Just run fixed 0803** (no wipe) |
| 0803 fails halfway and some tables exist | Run `000_wipe_public_schema.sql`, then 0803 again |
| Everything looks correct | Do not wipe |

Clearing the SQL editor text alone never deletes database data.
