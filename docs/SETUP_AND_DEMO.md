# Getting MFMS running, and presenting it

Two things live in this project and they are independent of each other:

| File | What it is | Needs installing? |
|---|---|---|
| `docs/mfms-website-demo.html` | The interface in one file, with an in-browser data layer | No — double-click it |
| the rest of the project | The real client/server application | Yes — Node.js and MySQL |

**They do not need to be in the same folder and they never talk to each other.** The demo
file is completely self-contained; you can email it, put it on a memory stick, or open it
from anywhere. Keep it as a backup for the presentation (see step 6 below).

---

## Part 1 — Getting the real application running

Do this on the machine you will present from, at least a day before. Budget 30–45
minutes the first time, almost all of it installing MySQL.

### Step 1 — Install Node.js

Download the LTS version from <https://nodejs.org> and install it. Then confirm:

```bash
node --version
```

You need v18 or higher.

### Step 2 — Install MySQL

Download MySQL Community Server from <https://dev.mysql.com/downloads/mysql/>.

During installation you will be asked to set a **root password**. Write it down — you
need it in step 4, and this is the single most common thing people lose. On Windows,
accept the default "Developer Default" setup and let it install MySQL as a service so it
starts automatically.

Confirm it is running:

```bash
mysql --version
mysql -u root -p        # type your password; you should get a mysql> prompt. \q to leave.
```

### Step 3 — Create the database

From inside the project folder (the one containing `README.md`):

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p mfms < database/seed.sql
```

Each command asks for the root password from step 2. Neither prints anything when it
works — silence is success. Check:

```bash
mysql -u root -p -e "USE mfms; SHOW TABLES;"
```

You should see 15 tables and 2 views.

### Step 4 — Install and configure the server

```bash
cd server
npm install
```

Then create your configuration file:

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Open `server/.env` in a text editor and set two things:

```
DB_PASSWORD=your_mysql_root_password_here
JWT_SECRET=any-long-random-string-you-like-at-least-30-characters
```

Leave `DB_HOST=127.0.0.1` alone. (It is deliberately not `localhost` — on Node 18+ that
can resolve to IPv6, where MySQL usually is not listening. This is the most common cause
of a "connection refused" error that looks unexplainable.)

### Step 5 — Start it

```bash
npm start
```

You should see:

```
  ✓ Database "mfms" connected — 4 staff accounts, 4 loan products

  MFMS running at http://localhost:4000  (development)
  Sign in with admin@mfms.co.za / Admin@123
```

Open <http://localhost:4000> in your browser.

If instead you get a red `✗ Cannot start` message, read it — it names the exact line of
`.env` to fix. The common ones are covered in the troubleshooting table below.

### Step 6 — Prove it works, then leave it alone

The end-to-end tests need the server running, so use **two terminals**.

Leave `npm start` running in the first one. In a second PowerShell window, `cd` to the
same `server` folder and run:

```
npm test      # 14 unit tests — interest, rounding, penalties, premiums. No database needed.
npm run e2e   # 61 end-to-end checks against the running API and MySQL
```

Then build a demonstration portfolio so the dashboard is not empty:

```
npm run seed:demo
```

It drives the real API to capture, approve, disburse and repay a spread of loans,
so every figure on the dashboard comes from the same code a user exercises.

Both test commands should come back green. `npm run e2e` rebuilds the database from `schema.sql` and
`seed.sql` every time, so it is safe to run repeatedly — and it puts the data back to a
known state, which makes it a handy reset before a rehearsal.

Now stop touching it until the presentation.

---

## Part 2 — Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| `✗ Cannot start` + `ECONNREFUSED` | MySQL is not running, or Node is looking at IPv6 | Start the MySQL service. If it IS running, check `DB_HOST=127.0.0.1` in `.env` |
| `✗ Cannot start` + `Access denied` | Wrong password in `.env` | Set `DB_PASSWORD` to your MySQL root password |
| `✗ Cannot start` + `does not exist yet` | Step 3 was skipped or failed | Re-run the two `mysql` commands from step 3 |
| `Port 4000 is already in use` | Something else has the port, often an old copy of this server | Close the other terminal, or set `PORT=4001` in `.env` |
| `'mysql' is not recognized` | MySQL is installed but not on your PATH | Use the full path, e.g. `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql"`, or add it to PATH |
| `npm install` fails | Usually no internet, or a corporate proxy | Try another network. `node_modules` can also be copied from a machine where it worked |
| `bash : The term 'bash' is not recognized` | You ran the old shell script | Use `npm run e2e` instead — it needs no extra tools |
| `npm run e2e` says no server responding | The server is not running | Start `npm start` in a second terminal and leave it open |
| Access denied when running the tests | The tests read `server/.env` too | If your password contains `#` or a space, wrap it in double quotes |
| Login page loads but sign-in fails with a database message | Server is up, MySQL is not | Start MySQL and refresh |

**Resetting the data.** If a rehearsal leaves the data messy, put it back:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p mfms < database/seed.sql
```

This drops and rebuilds everything. Do it the morning of the presentation so you start
from a known state.

---

## Part 3 — On presentation day

### Before you walk in

1. Start MySQL (it is usually automatic on Windows; check the Services panel).
2. Reset the data with the two commands above.
3. `cd server && npm start` — leave this terminal running and **do not close it**. Closing
   it stops the application.
4. Open <http://localhost:4000> and sign in once to check.
5. Open `docs/mfms-website-demo.html` in a second browser tab as your fallback.
6. Have `docs/wireframes.html`, `docs/crc-cards.html` and the report open in further tabs
   so you are not opening files while people watch.

### A ten-minute demonstration path

This route hits every rubric item and tells a story rather than touring screens.

**1. Sign in as the officer** (`officer@mfms.co.za` / `Officer@123`)

Point out the navigation: this officer has no "Staff & access" link. Role-based access is
enforced on the server, not hidden in the interface.

**2. Dashboard** — read the portfolio position out loud: outstanding, disbursed,
portfolio at risk, applications waiting. Note that PAR is the industry measure of a loan
book's health.

**3. Clients → Register a client**

Fill it in and submit. Point out the new client is `pending`, not active — an officer can
capture KYC but cannot approve a borrower onto the books.

**4. Try to lend to them.** Loans → New application, pick your new client... they are not
in the list, because only active clients can borrow. This is the business rule, visible.

**5. Loans → New application** with an existing client. Choose a product and note the
limits printed underneath. Enter an amount **above** the maximum and press *Price this
loan* — it is refused with the actual range.

Fix the amount, price it properly. **This is the moment to slow down.** The quote shows
the instalment, total interest, and the entire schedule before anything is committed.
Switch the product between the flat-rate and reducing-balance options and re-price to
show the two interest strategies producing different schedules from the same inputs —
that is the Strategy pattern doing visible work.

Submit for approval.

**6. Sign out. Sign in as the manager** (`manager@mfms.co.za` / `Manager@123`)

Open the pending loan and approve it. Then disburse it. Point out that the schedule did
not exist until this moment — it is generated at disbursement, inside one transaction
with the status change, so a loan can never be active without a schedule.

Show the passbook: the status rail down the left edge and the stamped state on each row.

**7. Sign out. Sign in as the teller** (`teller@mfms.co.za` / `Teller@123`)

Repayments → pick **Lerato Mahlangu's loan** (she is deliberately in arrears). Three
figures appear: due today including penalty, the full settlement figure, and the next due
date.

Post the payment. Show the receipt: the money is split penalty first, then interest, then
principal — and explain that surplus rolls forward so a client can settle early with one
payment.

**7b. Beneficiaries.** Open Clients, click a client, and scroll to *Nominated
beneficiaries*. The bar shows how much of the estate is allocated. Withdraw a
nomination and watch the bar turn red with the shortfall named — the system
refuses to leave a client in a state where a payout could not be split. Put it
back to 100%.

**7c. Credit life.** Open Insurance. Explain the shape: cover is issued
automatically when an insured loan is disbursed, in the same transaction as the
schedule, so a loan can never be live with a premium deducted and no policy.

Lodge a claim against an active policy, sign in as the manager to approve it,
then as the admin to settle it. The settlement advice is the moment worth
pausing on: the cover clears the loan outright, and because flat cover does not
fall as the client repays, the surplus is split across the nominated
beneficiaries by their exact shares. That is two modules — insurance and
beneficiaries — meeting at the one point where they matter.

**8. Reports** — the arrears register sorted worst-first with the responsible officer
named. Note that "Officer performance" shows *Restricted* for a teller.

**9. Sign in as the admin** and open Reports again — officer performance is now populated
and an audit trail panel appears. Explain that nothing wrote to that audit table directly:
the loan code publishes events and the audit observer subscribes, which is the Observer
pattern.

### Questions you are likely to get

**"Where are the design patterns?"** Six, all working code: Singleton (`config/db.js`),
Repository (`repositories/`), Strategy and Factory (`services/interest/`), Observer
(`services/EventBus.js`), Facade (the services). Have `InterestStrategy.js` open in an
editor — it is the clearest one to show.

**"How do you know the money is right?"** `npm test` and `npm run e2e`, 75 checks
between them. The one to mention is the check that reads a schedule back out of the
database and asserts the instalments sum to the total payable to the cent — that is what
proves the rounding reconciliation works.

**"Did anything go wrong?"** Yes, and say so: the settlement quote originally omitted
accrued penalties, so a client paying the quoted figure would have left the loan open. It
is written up as defect D-01 in section 7.3 of the report, and E2E-10 is the regression
test that stops it recurring. Being able to describe a bug you found and fixed is worth
more than claiming there were none.

**"Why is the portfolio at risk so high?"** Because the demonstration book has
four active loans and one of them is deliberately delinquent, so PAR is 35% by
construction. A real institution targets under 5%. Say that rather than letting
it pass — it shows you know what the number means.

**"Where does insurance fit?"** Credit life is priced by a second, independent
use of the Strategy pattern, in the same shape as the interest strategies. That
is the strongest evidence the pattern was a design decision rather than a label:
it was reused unchanged for an unrelated calculation.

**"What would you do next?"** Section 10.2 of the report. The honest short answer:
real SMS delivery instead of a queue, batch interest posting on savings, and moving
penalty configuration out of code into per-product rules.

### If the application will not start in the room

Do not debug in front of the audience. Open `docs/mfms-website-demo.html` and present
from that — it is the same interface and the same calculations, and it needs nothing but a
browser. Say plainly that it is the offline build and that the client/server version is
in the submission. Then carry on. Fix it afterwards.
