# Go live on Supabase

Everything is built and tested before this step. Until it is done, the app runs in **demo mode** (data stored on the device, role picker on the login screen). Connecting Supabase switches it to the real backend automatically: no code change.

Time needed: about 30 minutes. Steps marked 🤖 can be done by Claude in a session with the Supabase connector; steps marked 👤 need the owner.

## 1. 👤 Create the project

1. supabase.com → New project. Name: `mahroussa-pro`. Region: **West EU (Paris)** (closest to Algiers). Plan: Free.
2. Save the database password somewhere safe (password manager).
3. Database → Extensions: enable **pg_cron** and **pg_net** (both free).
4. Authentication → Sign In / Providers → Email: turn **off** "Allow new users to sign up" (accounts are created by the setup script only) and **off** "Confirm email".

## 2. 🤖 Apply the database

Apply every file in `supabase/migrations/` in order. Either:
- Claude, with the Supabase connector (`apply_migration` for each file), or
- the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.

Check: Table editor shows 12 shops and 10 categories. Database → Cron jobs shows `mahroussa-reminders` and `mahroussa-purge` (if pg_cron was enabled after the migrations, run the last `do $$ … cron.schedule … $$` block of `20261127000500_seed_reference_and_platform.sql` again).

## 3. 👤 + 🤖 Create the accounts

1. Copy `scripts/setup.config.example.json` to `scripts/setup.config.json` (git-ignored) and fill in the owner, deputy and labo emails and passwords, and the two team PINs. Leave `shopPins` empty to get random 6-digit PINs.
2. Run, with the **service role key** (Project settings → API; never put it in the app or in chat):

   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> node scripts/setup-supabase.mjs scripts/setup.config.json
   ```

3. `scripts/setup.output.json` now holds the 12 shop PINs, the team PINs and the push keys. Keep it private; give each shop manager only their PIN.

The script can be run again at any time (to change a PIN, set it in the config and rerun).

## 4. 🤖 Push notifications

Deploy the edge function and its secrets (values from `scripts/setup.output.json`):

```bash
supabase functions deploy notify --no-verify-jwt
```

```bash
supabase secrets set VAPID_PUBLIC_KEY=<vapid.publicKey> VAPID_PRIVATE_KEY=<vapid.privateKey> VAPID_SUBJECT=<vapid.subject> NOTIFY_SECRET=<notifySecret>
```

`--no-verify-jwt` is required because the database calls it; the function checks `NOTIFY_SECRET` itself.

## 5. 👤 Deploy the app

Cloudflare Pages (free) → connect the GitHub repo → build command `pnpm build`, output `dist`, environment variables:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **anon / publishable** key (safe in the app: RLS protects the data) |
| `VITE_VAPID_PUBLIC_KEY` | `vapid.publicKey` from `scripts/setup.output.json` |

Add a `_redirects` rule `/* /index.html 200` (single-page app routing) if Pages does not detect it.

## 6. 👤 Backups

GitHub → repo Settings → Secrets → Actions: add `SUPABASE_DB_URL` (Project settings → Database → connection string, with the password). The `backup` workflow then dumps the database every night and keeps 30 days.

## 7. Smoke test (one person, three phones or three browser tabs)

1. Owner signs in, adds 3 real products with photos (Catalogue).
2. Labo device signs in, does the handover with the team PIN, allows notifications.
3. A shop signs in with its PIN, installs the app, allows notifications, sends an order.
4. Owner gets the push, reduces one line, refuses one, sends to the labo.
5. Labo gets the alarm, ticks, reports a problem, closes.
6. Shop gets "prête à récupérer", taps Reçu. Owner sees it under Suivi → Livrées.

Then start the pilot with 2 shops (PRD §11).
