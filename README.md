# Microfinance Management System (MFMS)

A branch-level loan management system for a small microfinance institution: client
onboarding, loan pricing and approval, automatic repayment schedules, counter receipting,
savings passbooks, arrears tracking and portfolio reporting.

**Stack:** HTML · CSS · JavaScript · Node.js (Express) · MySQL 8

---

## Quick start

**Prerequisites:** Node.js 18 or newer, MySQL 8 or newer.

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure
cp .env.example .env
#    then edit .env: set DB_PASSWORD to your MySQL password and pick a JWT_SECRET

# 3. Create and populate the database
npm run db:setup

# 4. Start
npm start
```

Step 3 replaces the two `mysql -u root -p < …` commands the SQL files
themselves suggest. It reads the same `.env` the application uses, so it works
against a local MySQL and against a managed one without changing anything, and
it sidesteps the redirect (`<`) that PowerShell will not accept. The raw files
still load the usual way if you prefer:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p mfms < database/seed.sql
```

## Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)** to put the system on a public URL —
front end and back end together on one service, with a managed MySQL database.

Then, with the server running, build a realistic demonstration portfolio in a
second terminal:

```bash
npm run seed:demo
```

Open <http://localhost:4000>.

> **Presenting this?** `docs/SETUP_AND_DEMO.md` has the full install walkthrough, a
> troubleshooting table and a ten-minute demonstration script.

> **Just want to look at the site?** Open `docs/mfms-website-demo.html` in any browser.
> It is the same interface with an in-browser data layer instead of the Node/MySQL back
> end, so it needs no installation. The interest strategies, schedule factory, penalty
> rules and payment allocation in it are ports of the server-side code, so the figures it
> shows are calculated rather than mocked. It is a review aid — the marked application is
> the real client/server build above.

> If anything is misconfigured the server refuses to start and names the exact line of
> `.env` to fix. `DB_HOST` defaults to `127.0.0.1` rather than `localhost` on purpose —
> on Node 18+ `localhost` can resolve to IPv6, where MySQL is usually not listening.

### Demo accounts

| Email | Password | Role | Can do |
|---|---|---|---|
| admin@mfms.co.za | Admin@123 | Administrator | Everything, plus staff accounts and the audit trail |
| manager@mfms.co.za | Manager@123 | Branch manager | Approve, reject and disburse loans; all reports |
| officer@mfms.co.za | Officer@123 | Loan officer | Register clients, capture and price applications |
| teller@mfms.co.za | Teller@123 | Teller | Take repayments and savings transactions |

Delete these from `seed.sql` before any real deployment.

---

## Tests

```bash
cd server
npm test                  # 14 unit tests — interest, rounding, penalties, premiums (no database)
npm run e2e               # 61 end-to-end checks against the running API + MySQL
```

`npm run e2e` needs the server running in another terminal. It works on Windows, macOS and
Linux using only Node and the packages already installed — no bash, curl or mysql client
required. It rebuilds the database from `schema.sql` and `seed.sql` each run, so it is
repeatable. It signs in as all four roles, walks a loan from application through
approval, disbursement, repayment and settlement, and verifies the result with direct SQL
rather than trusting the API's own response.

---

## Layout

```
mfms/
├── database/
│   ├── schema.sql              15 tables, 2 reporting views, 1 stored procedure
│   └── seed.sql                Branches, staff, clients, loan products, demo data
├── server/
│   ├── src/
│   │   ├── config/             Environment + Database singleton (connection pool)
│   │   ├── middleware/         JWT authentication, role guards, error translation
│   │   ├── repositories/       All SQL lives here — one repository per table
│   │   ├── services/           Business rules
│   │   │   ├── interest/       Interest strategies + schedule factory
│   │   │   └── EventBus.js     Domain events, notification and audit observers
│   │   ├── controllers/        Request validation and response shaping
│   │   ├── routes/             The whole permission model on one screen
│   │   └── app.js, server.js
│   └── tests/                  Unit tests and the end-to-end script
├── public/                     The front end — one page per work area
│   ├── img/                    KhupFin logo, knockout variant and favicons
│   ├── css/app.css
│   ├── js/api.js               Fetch wrapper, session, formatting, shared UI
│   └── *.html
└── docs/
    ├── PROJECT_REPORT.md       The full project report
    ├── wireframes.html         All seven screens, annotated
    ├── crc-cards.html          20 printable CRC cards
    └── diagrams/
        ├── use-case-diagram.svg
        ├── context-diagram.mmd
        ├── dfd-level1.mmd
        ├── erd.mmd
        ├── class-diagram.mmd
        ├── state-loan.mmd
        └── sequence-repayment.mmd, sequence-disbursement.mmd
```

Open the `.html` files directly in a browser. The `.mmd` files are Mermaid sources — they
render in VS Code with the Mermaid extension, on GitHub, or by pasting into
<https://mermaid.live>.

---

## Design patterns in the code

These are working code, not diagram decoration:

| Pattern | Where | Why |
|---|---|---|
| Singleton | `config/db.js` | One connection pool shared by every repository |
| Repository | `repositories/` | SQL never leaks into services or controllers |
| Strategy | `services/interest/InterestStrategy.js` | Flat rate and reducing balance are interchangeable |
| Factory | `services/interest/ScheduleFactory.js` | Builds a dated schedule from loan terms |
| Observer | `services/EventBus.js` | SMS queue and audit trail subscribe to loan events |
| Strategy (again) | `services/insurance/PremiumStrategy.js` | Flat, declining and no-cover credit life pricing |
| Null Object | `NoCoverStrategy` | An uninsured product prices at zero instead of returning null |
| Facade | `services/LoanService.js` and siblings | Controllers stay thin |

---

## Notes on the domain

- **Interest.** Flat rate charges on the original principal; reducing balance charges only
  on what is still owed and uses a level annuity instalment. Rounding remainders are
  absorbed into the final instalment, so a schedule always sums exactly to the total
  payable.
- **Payment allocation.** Oldest instalment first; within an instalment, penalty, then
  interest, then principal. Surplus rolls forward, so a client can settle early with one
  payment; any true overpayment is reported back rather than silently banked.
- **Penalties** accrue per 30-day period on the unpaid amount and are capped at the value
  of the instalment itself.
- **Credit life.** Insured products issue a policy at disbursement, inside the same
  transaction as the schedule. Cover equals the full amount repayable, so a death
  claim clears the loan outright; any surplus is split across the client's
  nominated beneficiaries, whose shares must total exactly 100%.
- **Separation of duties.** A loan cannot be approved by the officer who captured it, and
  schedules are only written at disbursement — inside a single transaction with the status
  change, so a loan can never end up active without a schedule.
