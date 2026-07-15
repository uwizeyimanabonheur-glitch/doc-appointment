# Chronic Care Scheduler

A simple, **role-based** web app for scheduling appointments, notifications and
reminders in chronic disease patient care. Built with Next.js (App Router),
Prisma/Postgres, Vercel Cron, Web3Forms (email) and ClickSend (SMS).

Four roles, one adaptive UI:

| Role    | Can do |
|---------|--------|
| **Patient** | View own appointments; receive email + SMS notifications |
| **Nurse**   | Register patients, book appointments per doctor, edit/delete *pending* appointments |
| **Doctor**  | View assigned appointments, accept/update, mark done; get notified |
| **Admin**   | Full CRUD on patients/staff/appointments + statistics dashboard |

---

## 1. Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your .env from the template
cp .env.example .env
#    → fill in DATABASE_URL

# 3. Create the database tables
npm run db:migrate     # applies prisma/migrations (or: npm run db:push)

# 4. Seed demo users + sample data
npm run db:seed

# 5. Run it
npm run dev            # http://localhost:3000
```

### Need a local Postgres for testing?

If you don't have a database yet, run a throwaway one in Docker (host port
`5433` to avoid clashing with any local Postgres on 5432):

```bash
docker run -d --name docapp-postgres \
  -e POSTGRES_USER=docapp -e POSTGRES_PASSWORD=docapp -e POSTGRES_DB=docapp \
  -p 5433:5432 postgres:16-alpine
```

Then in `.env`:
```
DATABASE_URL="postgresql://docapp:docapp@localhost:5433/docapp?schema=public"
```

Remove it when you're done (leaves no trace in the repo):
```bash
docker rm -f docapp-postgres
```

**Demo logins** (password `password123`):
`admin@example.com` · `nurse@example.com` · `doctor@example.com` · `patient@example.com`

> The app runs **even without email/SMS keys** — those notifications are simply
> logged to the server console until you add real keys.

---

## 2. What you need to create on each provider

You must create the following accounts/keys and paste them into `.env`.
Everything is a placeholder in `.env.example`.

### 🗄️ Database — Postgres (required)
Any Postgres works. Easiest options:
- **Vercel Postgres / Prisma Postgres** — Vercel dashboard → *Storage* → *Create Database*.
  Copy the `DATABASE_URL` (pooled) it gives you.
- **Neon / Supabase / local Postgres** — any connection string works too.

Set:
```
DATABASE_URL=...   # pooled connection (runtime)
```

### 🔐 Session secret (required)
Sign-in cookies are signed with this. Generate one:
```bash
openssl rand -hex 32
```
Set: `SESSION_SECRET=...`

### 📧 Email — Web3Forms (optional, for email notifications)
1. Go to **https://web3forms.com** → enter the inbox that should receive
   notifications → you'll get an **Access Key** by email.
2. Set: `WEB3FORMS_ACCESS_KEY=...`

> Note: Web3Forms delivers to the inbox tied to the access key; the intended
> recipient is included in the message body / reply-to.

### 📱 SMS — ClickSend (optional, for SMS notifications)
1. Sign up at **https://www.clicksend.com**.
2. Dashboard → **API Credentials**: copy your **Username** and **API Key**.
3. Set:
   ```
   CLICKSEND_USERNAME=...
   CLICKSEND_API_KEY=...
   CLICKSEND_SENDER=DocApp     # optional sender id / number
   ```

### ⏰ Cron secret (required for reminders in production)
Protects the reminder endpoint so only Vercel Cron can call it.
```bash
openssl rand -hex 32
```
Set: `CRON_SECRET=...` and `REMINDER_DAYS_BEFORE=1`

---

## 3. Deploy to Vercel

**Migrations run automatically.** The build command is
`prisma generate && prisma migrate deploy && next build`, so on every deploy
Vercel creates/updates your tables from the committed `prisma/migrations/`
folder. You never run a manual migration step — that's the usual Prisma-on-Vercel
pain point, removed.

Steps:

1. Push this repo to GitHub and **Import** it in Vercel.
2. In **Project → Settings → Environment Variables**, add the vars from section 2.

   **If you use Vercel Postgres**, it creates variables with different names —
   map them like this (Vercel value → the name this app expects):

   | Set this name | to the value of |
   |---------------|-----------------|
   | `DATABASE_URL` | `POSTGRES_PRISMA_URL` (pooled) |

   (Neon/Supabase just give you a normal connection string — use it for both,
   or use their pooled + direct URLs respectively.)
3. **Deploy.** Tables are created on the first build automatically.
4. Vercel auto-detects the cron schedule from [`vercel.json`](./vercel.json)
   (`/api/cron/reminders` daily at 08:00 UTC).
5. *(Optional)* seed demo data once, pointing at your production DB:
   ```bash
   ```

You can test the reminder job manually:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/reminders
```

---

## 4. Notification flow

- **Booking** — Nurse books → **Doctor** notified (email + SMS).
- **Confirmation** — Doctor accepts → **Patient + Nurse** notified.
- **Reminder** — Vercel Cron runs daily → appointments within
  `REMINDER_DAYS_BEFORE` days → **Patient + Doctor** notified (once).

---

## 5. Project structure

```
prisma/
  schema.prisma          # User, Patient, Appointment + enums
  seed.ts                # demo users & appointments
src/
  middleware.ts          # auth gate (redirects to /login)
  lib/
    prisma.ts            # Prisma client singleton
    session.ts           # signed-cookie sessions (HMAC)
    auth.ts              # getCurrentUser / requireUser / requireRole
    roles.ts             # role permission helpers
    notifications.ts     # Web3Forms email + ClickSend SMS (graceful fallback)
    appointment-events.ts# booking / confirmation / reminder flows
  app/
    login/               # sign in
    dashboard/           # role-adaptive overview
    appointments/        # role-filtered table + booking/accept/done
    patients/new/        # patient registration (Nurse/Admin)
    stats/               # admin charts (Recharts)
    api/                 # auth, patients, appointments, users, stats, cron
```

## 6. Notes / simplifications

- Auth is intentionally simple (email + shared demo password) for a school
  project. For production, replace `User.password` with a hash (e.g. bcrypt).
- A patient logs in as a `User` with role `PATIENT`; their clinical `Patient`
  record is linked by email so they see their own appointments.
- The Prisma schema extends the one in `project.md` with contact fields
  (`phone`, patient `email`/`phone`), named relations and a `reminderSent`
  flag so notifications and role-scoping actually work.
