# Deploying KhupFin

Andzani Ntlemo · EDUV4820290 · ITTFA4-B21

This puts the whole system — front end and back end together — on a public URL.
Written for Windows PowerShell, since that is what you are working in.

---

## Read this first: what to actually use for the presentation

Deploy it. A live URL is worth having, and it demonstrates the full stack. But
**present from `localhost`**, with the deployed URL as the thing you show at the
end.

The reason is specific, not general caution. A free web service on Render
**sleeps after about 15 minutes of inactivity**. The next request wakes it,
which takes roughly **50 seconds** of blank screen. If your lecturer opens the
link cold, that is 50 seconds of nothing while you explain why nothing is
happening. Locally the app starts in under two seconds and the database is on
the same machine.

So:

| | For marks | Method |
|---|---|---|
| **Primary demo** | the application itself | `npm start`, open `localhost:4000` |
| **Also show** | that it deploys and runs publicly | the Render URL, opened a few minutes beforehand to wake it |

If you do open the deployed URL during the presentation, **load it once about
two minutes before you start**. It then stays awake for the whole session.

---

## Why this combination of services

Your rubric specifies MySQL, and that constraint rules out most of what is
free today. Free *PostgreSQL* is everywhere; free *MySQL* has largely
disappeared — Aiven, which used to be the standard recommendation, no longer
offers MySQL on its free plan at all, and its cheapest MySQL is a paid tier.
Older tutorials recommending Railway or Aiven free MySQL are out of date.

**TiDB Cloud** is what still works without paying. It speaks the MySQL wire
protocol, so `mysql2` connects to it unchanged, your `schema.sql` loads into it,
and every query in the application runs against it as written.

The one thing it will not accept is `CREATE PROCEDURE`, and that turns out not
to matter here: the only stored procedure in the schema is `sp_flag_overdue`,
and **nothing in the application calls it** — `ScheduleRepository.markOverdue()`
already does that work in JavaScript. The setup script reports the refusal and
carries on. Your schema file keeps the procedure, so the report and the database
design deliverable are unaffected.

If you would rather pay about $5/month for real MySQL (Aiven, Clever Cloud), the
steps below work identically — only the connection details change, and you can
skip the note about the procedure.

---

## What the code already does for you

These were added for deployment, so you do not have to change code:

| Variable | Why it exists |
|---|---|
| `DATABASE_URL` | Providers hand you one connection string. Set it and the five separate `DB_*` settings are ignored. |
| `DB_SSL=true` | Managed MySQL refuses unencrypted connections. Local MySQL does not use this. |
| `DB_SSL_CA` | Only for providers using their own certificate authority. TiDB does not need it. |
| `DB_POOL_SIZE` | Free database tiers cap concurrent connections below the default of 10. |

Two safety behaviours also switch on when `NODE_ENV=production`:

- The server **refuses to start** if `JWT_SECRET` is still the placeholder. That
  value is printed in `.env.example` and in your report, so anyone who read
  either could forge an administrator session.
- CORS stops accepting every origin. The front end is served by the same
  process, so it does not need cross-origin access.

---

## Before you start

Three free accounts, no card required for any of them:

1. **GitHub** — github.com
2. **TiDB Cloud** — tidbcloud.com (the free plan may be labelled *Serverless* or
   *Starter*; both are the same thing)
3. **Render** — render.com (sign in with GitHub, which saves a step later)

And locally: Git installed. Check with `git --version`. If it is missing, get it
from git-scm.com and accept every default.

---

## Part 1 — Put the project on GitHub

Render deploys from a Git repository, so the code has to be there first.

Open PowerShell in your project folder (the one containing `server`, `public`
and `database`):

```powershell
cd C:\path\to\mfms
```

Confirm you are in the right place — this should list `server`, `public`,
`database`:

```powershell
ls
```

Now create the repository:

```powershell
git init
git add .
git commit -m "KhupFin microfinance management system"
```

> **Check the commit output.** It must **not** mention `server/.env` or
> `node_modules`. The `.gitignore` in the project root excludes them. If you see
> `.env` listed, stop and tell me — that file holds your database password.

Create an **empty** repository on github.com (no README, no .gitignore), then
connect and push. Replace `YOUR-USERNAME`:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/khupfin.git
git branch -M main
git push -u origin main
```

Refresh the GitHub page. Your files should be there.

---

## Part 2 — Create the cloud database

1. Sign in to **tidbcloud.com**.
2. Create a cluster on the free plan. Choose the region closest to South
   Africa — Frankfurt (`eu-central-1`) is usually the nearest offered.
3. Wait until its status is **Available** (a minute or two).
4. Click **Connect**. Choose **General** or **Node.js** as the connection type.
5. Generate a password when prompted and **copy it immediately** — most
   providers show it only once.

You now have five pieces of information:

| | Looks like |
|---|---|
| Host | `gateway01.eu-central-1.prod.aws.tidbcloud.com` |
| Port | `4000` *(not 3306 — this catches people out)* |
| User | `3pTAoNNegb47Uc8.root` |
| Password | the one you just copied |
| Database | `test` |

### Create your own database

The default database is called `test`. Make a proper one: in TiDB Cloud, open
the **SQL Editor** (sometimes **Chat2Query**) and run:

```sql
CREATE DATABASE mfms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Allow connections

Open **Settings → Networking** on the cluster. While setting up, allow access
from anywhere (`0.0.0.0/0`). Narrow it afterwards if you want to — but note that
Render's free tier does not give you a fixed outbound address, so in practice
this needs to stay open for the deployment to work.

---

## Part 3 — Load your schema into the cloud database

This is the step the usual instructions make painful: pointing the `mysql`
command-line client at a TLS endpoint, and PowerShell refusing the `<` redirect.
You do not need either. The script uses the same connection settings the
application uses.

Edit `server\.env` on your PC and point it at the cloud database. Keep a copy of
your local settings first — you will want them back for the presentation:

```powershell
Copy-Item server\.env server\.env.local-backup
notepad server\.env
```

Replace the contents with your TiDB details:

```
PORT=4000
NODE_ENV=development

DATABASE_URL=mysql://3pTAoNNegb47Uc8.root:YOUR-PASSWORD@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/mfms
DB_SSL=true

JWT_SECRET=anything-for-now-this-run-is-local
JWT_EXPIRES_IN=8h
```

> **If your password contains `@`, `/`, `:`, `#` or `?`**, it has to be
> percent-encoded inside the URL, or the URL parser will read it as a separator
> and you will get "access denied". Encode it:
>
> ```powershell
> [System.Uri]::EscapeDataString("your#raw@password")
> ```
>
> Paste the result into the URL. Alternatively skip `DATABASE_URL` and use the
> separate `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` settings
> with the password in double quotes — no encoding needed that way.

Check the connection before changing anything. This connects and reports what it
*would* do:

```powershell
cd server
npm run db:check
```

You should see your cloud host, `TLS on`, and the TiDB version. If it fails, go
to the troubleshooting table at the end — the error message names the fix.

Now load it for real. Call the script directly rather than through `npm run` —
passing a flag through npm needs an extra `--` that PowerShell handles
inconsistently, and calling node avoids the question entirely:

```powershell
node scripts/db-setup.js --no-create
```

`--no-create` is there because the provider owns the database; the script loads
into the one you created rather than trying to create its own.

Expect, at the end:

```
      ! CREATE PROCEDURE sp_flag_overdue refused by this server (...).
        Not a problem: no application code calls it.

  ✓ Database ready
      21 tables and views, 4 staff accounts, 4 loan products
```

That procedure line is expected on TiDB and is not an error.

### Prove it works before deploying

Run the application locally against the cloud database:

```powershell
npm start
```

Open `localhost:4000`, sign in as `admin@mfms.co.za` / `Admin@123`, and click
through a screen or two. It will feel slower than local MySQL because every
query now crosses the internet — that is expected and is why you present from
localhost.

**If this works, the deployment will work.** You have just proved the database,
the credentials, TLS and the schema are all correct. Everything after this is
configuration. Stop the server with `Ctrl+C`.

---

## Part 4 — Deploy to Render

1. Sign in to **render.com** with GitHub.
2. **New → Web Service**, and pick your `khupfin` repository.
3. Fill in:

| Field | Value |
|---|---|
| Name | `khupfin` |
| Region | Frankfurt |
| Branch | `main` |
| Root Directory | *leave empty* |
| Runtime | Node |
| Build Command | `npm install --prefix server --omit=dev` |
| Start Command | `node server/src/server.js` |
| Instance Type | **Free** |

> The two commands are the usual cause of a failed first deploy. Dependencies
> live in `server/package.json`, not at the root, so `--prefix server` is what
> makes `npm install` find them.

4. Add the environment variables. **Advanced → Add Environment Variable**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the same URL you put in `.env` |
| `DB_SSL` | `true` |
| `DB_POOL_SIZE` | `5` |
| `JWT_SECRET` | generate it — see below |

Generate the secret on your PC and paste the output:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Do not reuse the placeholder. The server will refuse to start with it, by
design.

5. Set **Health Check Path** to `/health`.
6. **Create Web Service**.

Watch the log. A successful start ends with:

```
  ✓ Database "mfms" connected — 4 staff accounts, 4 loan products

  MFMS listening on port 10000 (production)
  Database gateway01....tidbcloud.com:4000/mfms over TLS
```

Your URL is `https://khupfin.onrender.com` (with whatever name you chose).

---

## Part 5 — Secure the deployed copy

**Do this before you share the link.** The demo passwords are printed in
`seed.sql`, in your report and in the setup instructions. That is correct for a
local demonstration and wrong on a public URL — anyone who reads your report
could sign in as the administrator.

With `server\.env` still pointing at the cloud database, from the `server`
folder:

```powershell
node scripts/set-password.js --list
node scripts/set-password.js admin@mfms.co.za "a password you choose"
node scripts/set-password.js manager@mfms.co.za "another one"
node scripts/set-password.js officer@mfms.co.za "another one"
node scripts/set-password.js teller@mfms.co.za "another one"
```

Quote each password, or PowerShell splits it at the spaces. The script verifies
each change against the stored hash and confirms it.

Write them down somewhere that is not the repository.

### Put your local settings back

For the presentation you want localhost again:

```powershell
Copy-Item server\.env.local-backup server\.env -Force
cd server
npm start
```

The deployed copy is unaffected — it reads its configuration from Render, not
from this file.

---

## Updating the deployed site

Render redeploys automatically on every push:

```powershell
git add .
git commit -m "describe what changed"
git push
```

Changes appear in two or three minutes.

---

## Troubleshooting

The scripts print the fix with the error. The common ones:

| Message | Cause | Fix |
|---|---|---|
| `ETIMEDOUT` | The provider is not allowing your address | TiDB Cloud → Settings → Networking → allow `0.0.0.0/0` |
| `ENOTFOUND` | Hostname wrong or truncated | Copy it again from the Connect dialog |
| `HANDSHAKE_SSL_ERROR` | TLS not enabled, or CA missing | Set `DB_SSL=true`. If already set, set `DB_SSL_CA` to the provider's `.pem`. To confirm that is the cause, try `DB_SSL=insecure` once — if it connects, the CA is what is missing |
| `ER_ACCESS_DENIED_ERROR` | Password wrong, or a special character broke the URL | Percent-encode it, or use the separate `DB_*` settings with the password in double quotes |
| `ER_DBACCESS_DENIED_ERROR` | Wrong database name | Set it to the one you created, and use `--no-create` |
| `ER_BAD_DB_ERROR` | Database does not exist | Create it in the provider's SQL editor |
| `Refusing to start: JWT_SECRET is still the placeholder` | Working as intended | Set a real `JWT_SECRET` in Render |
| Build fails, `ENOENT package.json` | Build command wrong | It must be `npm install --prefix server --omit=dev` |
| Deploy succeeds, site shows nothing | Usually the service asleep | Wait ~50 seconds on first load |
| `CREATE PROCEDURE ... refused` | Expected on TiDB | Nothing to fix; no code calls it |

### If the deployed site cannot reach the database

Open `https://your-app.onrender.com/health`. It answers without a login:

```json
{"status":"ok","database":true,"time":"..."}
```

`"database": false` means the app is running but cannot reach MySQL — the
problem is in the Render environment variables, not in your code. Compare them
against the `.env` that worked locally in Part 3.

---

## Checklist

- [ ] Project pushed to GitHub, with no `.env` in the repository
- [ ] Cloud database created, `mfms` database added
- [ ] Networking set to allow connections
- [ ] `node scripts/db-setup.js --no-create` completed — 21 tables and views
- [ ] App run locally against the cloud database and signed into
- [ ] Render web service created with both commands correct
- [ ] All five environment variables set, `JWT_SECRET` freshly generated
- [ ] Deployed URL loads and signs in
- [ ] **All four demo passwords changed**
- [ ] `server\.env` restored to local settings for the presentation
- [ ] Deployed URL opened two minutes before presenting, so it is awake
