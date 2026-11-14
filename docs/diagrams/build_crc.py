#!/usr/bin/env python3
"""Builds docs/crc-cards.html — printable Class Responsibility Collaborator cards."""

CARDS = [
    ("Database", "Infrastructure — Singleton", [
        "Hold the single MySQL connection pool for the whole process",
        "Execute parameterised queries and return rows",
        "Open, commit and roll back transactions on behalf of services",
        "Report whether the database is reachable (health check)",
    ], ["mysql2 driver", "env configuration", "every Repository"]),

    ("BaseRepository", "Data access — Repository", [
        "Provide find, create, update, delete and count for one table",
        "Restrict writes to an explicit list of fillable columns",
        "Accept an open transaction so several repositories can share one",
        "Keep all SQL out of the service and controller layers",
    ], ["Database", "concrete repositories"]),

    ("ClientRepository", "Data access", [
        "Search the client register by name, number, phone or ID",
        "Fetch a client joined to their branch and officer",
        "Detect a duplicate national ID before registration",
        "Issue the next sequential client number",
    ], ["BaseRepository", "Database", "ClientService"]),

    ("LoanRepository", "Data access", [
        "Search and filter loans with client and product detail",
        "Issue the next sequential loan number inside a transaction",
        "Summarise the portfolio for the dashboard",
        "Return the six-month disbursement trend",
    ], ["BaseRepository", "LoanService", "ReportService"]),

    ("ScheduleRepository", "Data access", [
        "Bulk-insert a generated repayment schedule in one round trip",
        "Return outstanding instalments for a loan, oldest first",
        "Produce the arrears register and the instalments-due list",
        "Flag instalments that have passed their due date",
    ], ["BaseRepository", "LoanService", "RepaymentService"]),

    ("InterestStrategy", "Domain — Strategy interface", [
        "Declare a single way to turn loan terms into instalments",
        "Reconcile rounding so instalments sum exactly to the total",
    ], ["FlatRateStrategy", "ReducingBalanceStrategy", "ScheduleFactory"]),

    ("FlatRateStrategy", "Domain — Strategy", [
        "Charge interest on the original principal for the whole term",
        "Split principal and interest evenly across instalments",
        "Absorb any rounding remainder into the final instalment",
    ], ["InterestStrategy", "ScheduleFactory"]),

    ("ReducingBalanceStrategy", "Domain — Strategy", [
        "Accrue interest only on the outstanding balance",
        "Compute a level annuity instalment (EMI)",
        "Guarantee the closing balance is exactly zero",
    ], ["InterestStrategy", "ScheduleFactory"]),

    ("ScheduleFactory", "Domain — Factory", [
        "Convert a term in months into instalments for the frequency",
        "Select the interest strategy the product calls for",
        "Attach real due dates, handling short months correctly",
        "Return the schedule with totals: interest, payable, maturity",
    ], ["InterestStrategy", "LoanService"]),

    ("LoanService", "Application — Facade", [
        "Quote a loan without saving anything",
        "Enforce product limits on amount and term",
        "Refuse a second application while one is open",
        "Approve or reject, keeping capture and approval separate",
        "Disburse: generate the schedule and activate the loan in one transaction",
        "Publish loan events for observers to act on",
    ], ["LoanRepository", "ScheduleRepository", "ScheduleFactory", "EventBus", "ClientRepository"]),

    ("RepaymentService", "Application — Facade", [
        "State what a client owes today, including accrued penalty",
        "Cap a penalty at the value of the unpaid instalment",
        "Allocate a payment: penalty, then interest, then principal",
        "Roll surplus forward and return any true overpayment",
        "Close the loan when the balance reaches zero",
    ], ["ScheduleRepository", "RepaymentRepository", "LoanRepository", "EventBus"]),

    ("ClientService", "Application", [
        "Register a client and allocate their client number",
        "Block a duplicate national ID with a useful message",
        "Change client status, refusing to deactivate a live borrower",
        "Assemble the profile: details, loans and savings together",
    ], ["ClientRepository", "LoanRepository", "SavingsRepository", "EventBus"]),

    ("SavingsService", "Application", [
        "Open a passbook account with an optional opening deposit",
        "Post deposits, withdrawals, interest and fees",
        "Lock the account row so concurrent postings cannot overdraw it",
        "Produce a running-balance statement",
    ], ["SavingsRepository", "Database", "EventBus"]),

    ("AuthService", "Application — Security", [
        "Verify a password against its bcrypt hash",
        "Give one identical message for a wrong email or password",
        "Issue and verify signed JWT session tokens",
        "Create staff accounts and change passwords",
    ], ["UserRepository", "AuthMiddleware"]),

    ("EventBus", "Cross-cutting — Observer", [
        "Accept published domain events from the services",
        "Notify every registered observer without the publisher knowing them",
        "Deliver asynchronously so a failing observer cannot break a payment",
    ], ["NotificationObserver", "AuditObserver", "LoanService", "RepaymentService"]),

    ("NotificationObserver", "Cross-cutting — Observer", [
        "Queue a client SMS on approval, rejection, disbursement, receipt and settlement",
        "Write plain messages a borrower can act on",
    ], ["EventBus", "NotificationRepository"]),

    ("AuditObserver", "Cross-cutting — Observer", [
        "Record who did what, to which record, and when",
        "Store the supporting detail as JSON for later inspection",
    ], ["EventBus", "AuditRepository"]),

    ("PremiumStrategy", "Domain — Strategy interface", [
        "Declare one way to turn loan terms into a credit life premium",
        "Return a quote carrying the premium, the sum assured and how it was derived",
    ], ["FlatCoverStrategy", "DecliningCoverStrategy", "NoCoverStrategy", "InsuranceService"]),

    ("FlatCoverStrategy", "Domain — Strategy", [
        "Hold the sum assured at the full amount repayable for the whole term",
        "Charge the premium on that cover for each year of the term",
        "Leave a surplus for the family when a claim comes late in the loan",
    ], ["PremiumStrategy", "InsuranceService"]),

    ("DecliningCoverStrategy", "Domain — Strategy", [
        "Track the sum assured against the outstanding balance",
        "Charge the premium on average exposure rather than the full amount",
    ], ["PremiumStrategy", "InsuranceService"]),

    ("NoCoverStrategy", "Domain — Strategy (Null Object)", [
        "Price an uninsured product at zero without returning null",
        "Spare every caller from branching on the absence of cover",
    ], ["PremiumStrategy", "InsuranceService"]),

    ("InsuranceService", "Application — Facade", [
        "Price cover for a quote without saving anything",
        "Issue a policy inside the disbursement transaction, never after it",
        "Refuse a claim dated before cover began or in the future",
        "Allow only one open claim against a policy at a time",
        "Settle a claim: clear the loan, then split the surplus to the family",
        "Publish claim events for the notification and audit observers",
    ], ["PremiumStrategy", "PolicyRepository", "ClaimRepository", "BeneficiaryService", "LoanRepository", "EventBus"]),

    ("BeneficiaryService", "Application", [
        "Keep a client's active nominations totalling exactly 100%",
        "Refuse a nomination that would push the shares past 100%",
        "Retire a nomination rather than delete it, so history survives a later claim",
        "Split a payout across the shares, sending the rounding remainder to the largest",
        "List clients holding money with nobody nominated",
    ], ["BeneficiaryRepository", "ClientRepository", "EventBus", "InsuranceService"]),

    ("PolicyRepository", "Data access", [
        "Issue the next sequential policy number inside a transaction",
        "Compute cover in force, which for a declining policy follows the loan balance",
        "Summarise the book: policies, premiums written, cover, claims paid",
    ], ["BaseRepository", "InsuranceService"]),

    ("ClaimRepository", "Data access", [
        "Issue the next sequential claim number",
        "Return claims joined to their policy, loan and client",
    ], ["BaseRepository", "InsuranceService"]),

    ("BeneficiaryRepository", "Data access", [
        "Return a client's active nominations",
        "Total the active shares, optionally excluding one under edit",
        "Find active clients with savings or loan exposure and no nomination",
    ], ["BaseRepository", "BeneficiaryService"]),

    ("AuthMiddleware", "Presentation — Guard", [
        "Reject any API request without a valid session token",
        "Attach the caller's identity and role to the request",
        "Enforce role rules per route (requireRole)",
    ], ["AuthService", "every controller"]),

    ("LoanController", "Presentation — Controller", [
        "Validate the request body and return field-level errors",
        "Delegate all decisions to LoanService",
        "Shape the HTTP response and status code",
    ], ["LoanService", "AuthMiddleware", "validate()"]),

    ("ReportService", "Application — Reporting", [
        "Compute portfolio totals and portfolio at risk",
        "Rank officers by disbursement and recovery",
        "Break the book down by product",
    ], ["LoanRepository", "ScheduleRepository", "RepaymentRepository"]),
]

head = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MFMS — CRC Cards</title>
<style>
  :root{--ink:#10201C;--soft:#5A6B66;--line:#C9D2CC;--brand:#0C4A3E;--paper:#F3F4F2}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
       font-family:'Segoe UI',system-ui,sans-serif;line-height:1.45}
  header{padding:36px 40px 22px;background:#fff;border-bottom:1px solid var(--line)}
  header h1{margin:0;font-size:24px}
  header p{margin:6px 0 0;color:var(--soft);max-width:74ch;font-size:14px}
  main{padding:28px 40px 70px;display:grid;
       grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px;max-width:1300px;margin:0 auto}
  .card{background:#fff;border:1px solid var(--line);border-radius:4px;overflow:hidden;
        display:flex;flex-direction:column;break-inside:avoid}
  .card h2{margin:0;padding:12px 16px 4px;font-size:15.5px}
  .card .kind{padding:0 16px 12px;font-size:11px;letter-spacing:.08em;
              text-transform:uppercase;color:var(--brand);font-weight:600}
  .split{display:grid;grid-template-columns:1.35fr 1fr;border-top:1px solid var(--line);flex:1}
  .split > div{padding:12px 16px}
  .split > div + div{border-left:1px solid var(--line);background:#FBFCFB}
  .split h3{margin:0 0 7px;font-size:10.5px;letter-spacing:.09em;
            text-transform:uppercase;color:var(--soft);font-weight:600}
  ul{margin:0;padding-left:16px}
  li{font-size:13px;margin-bottom:5px}
  .split > div + div li{color:#3C4B46}
  @media print{
    body{background:#fff}
    main{grid-template-columns:repeat(2,1fr);padding:16px}
    header{padding:16px}
  }
</style></head>
<body>
<header>
  <h1>Microfinance Management System — CRC Cards</h1>
  <p>One card per class in the delivered application. Each lists what the class is answerable for and
     which other classes it must work with to meet those responsibilities. Cards are grouped by the layer
     the class belongs to: infrastructure, data access, domain, application, cross-cutting and presentation.</p>
</header>
<main>
"""

body = []
for name, kind, resp, collab in CARDS:
    body.append('<article class="card">')
    body.append(f'  <h2>{name}</h2>')
    body.append(f'  <div class="kind">{kind}</div>')
    body.append('  <div class="split">')
    body.append('    <div><h3>Responsibilities</h3><ul>')
    body.extend(f'      <li>{r}</li>' for r in resp)
    body.append('    </ul></div>')
    body.append('    <div><h3>Collaborators</h3><ul>')
    body.extend(f'      <li>{c}</li>' for c in collab)
    body.append('    </ul></div>')
    body.append('  </div>')
    body.append('</article>')

html = head + "\n".join(body) + "\n</main>\n</body>\n</html>\n"
open("docs/crc-cards.html", "w").write(html)
print(f"crc-cards.html written — {len(CARDS)} cards")
