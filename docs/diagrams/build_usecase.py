#!/usr/bin/env python3
"""Generates docs/diagrams/use-case-diagram.svg (UML use case diagram)."""

W, H = 1180, 900
INK = "#10201C"
LINE = "#7A8B85"
BRAND = "#0C4A3E"
GOLD = "#B07D0A"

parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
    f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>',
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{LINE}"/></marker></defs>',
    f'<text x="{W//2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="{INK}">'
    'Microfinance Management System — Use Case Diagram</text>',
]

# ---- system boundary ----
parts.append(f'<rect x="235" y="48" width="700" height="820" rx="6" fill="none" stroke="{BRAND}" stroke-width="1.6"/>')
parts.append(f'<text x="585" y="70" text-anchor="middle" font-size="13" font-weight="bold" fill="{BRAND}">MFMS</text>')


def actor(x, y, label, sub):
    """Stick figure with a two-line caption."""
    g = [
        f'<circle cx="{x}" cy="{y}" r="12" fill="none" stroke="{INK}" stroke-width="1.6"/>',
        f'<line x1="{x}" y1="{y+12}" x2="{x}" y2="{y+42}" stroke="{INK}" stroke-width="1.6"/>',
        f'<line x1="{x-18}" y1="{y+24}" x2="{x+18}" y2="{y+24}" stroke="{INK}" stroke-width="1.6"/>',
        f'<line x1="{x}" y1="{y+42}" x2="{x-15}" y2="{y+66}" stroke="{INK}" stroke-width="1.6"/>',
        f'<line x1="{x}" y1="{y+42}" x2="{x+15}" y2="{y+66}" stroke="{INK}" stroke-width="1.6"/>',
        f'<text x="{x}" y="{y+84}" text-anchor="middle" font-size="12.5" font-weight="bold" fill="{INK}">{label}</text>',
        f'<text x="{x}" y="{y+99}" text-anchor="middle" font-size="10.5" fill="#5A6B66">{sub}</text>',
    ]
    ACTOR_ART.extend(g)


def usecase(x, y, label, ident):
    rx, ry = 100, 26
    SHAPES.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#F4F8F5" stroke="{BRAND}" stroke-width="1.3"/>')
    lines = label.split("|")
    start = y + 4 - (len(lines) - 1) * 7
    for i, ln in enumerate(lines):
        SHAPES.append(f'<text x="{x}" y="{start + i*14}" text-anchor="middle" font-size="11.5" fill="{INK}">{ln}</text>')
    UC[ident] = (x, y, rx, ry)


UC = {}
LABELS = []
SHAPES = []
ACTOR_ART = []

# ---- actors ----
ACTORS = {
    "officer": (95, 120, "Loan Officer", "captures clients &amp; loans"),
    "teller":  (95, 320, "Teller", "receives payments"),
    "manager": (95, 520, "Branch Manager", "credit decisions"),
    "admin":   (95, 720, "Administrator", "system &amp; access"),
    "client":  (1085, 250, "Client", "borrower (indirect)"),
    "sms":     (1085, 600, "SMS Gateway", "external service"),
}
for x, y, label, sub in ACTORS.values():
    actor(x, y, label, sub)

# ---- use cases: left column ----
usecase(390, 105, "Sign in", "signin")
usecase(390, 175, "Register client", "regclient")
usecase(390, 245, "Search &amp; view|client profile", "viewclient")
usecase(390, 315, "Set client status|(activate / blacklist)", "status")
usecase(390, 385, "Capture loan|application", "apply")
usecase(390, 455, "Price loan|(preview schedule)", "preview")
usecase(390, 525, "Record repayment", "repay")
usecase(390, 595, "Open savings|account", "opensav")
usecase(390, 665, "Post savings|transaction", "savtxn")
usecase(390, 735, "View dashboard", "dash")
usecase(390, 812, "Manage staff|accounts", "staff")

# ---- use cases: right column ----
usecase(775, 140, "Approve loan", "approve")
usecase(775, 210, "Reject loan", "reject")
usecase(775, 285, "Disburse funds", "disburse")
usecase(775, 360, "Generate repayment|schedule", "schedule")
usecase(775, 435, "Issue receipt", "receipt")
usecase(775, 510, "Calculate late|penalty", "penalty")
usecase(775, 590, "Queue client|notification", "notify")
usecase(775, 670, "Generate reports", "reports")
usecase(775, 745, "Write off loan", "writeoff")
usecase(775, 820, "View audit trail", "audit")


LINKS = []   # drawn UNDER the use-case ellipses
def assoc(actor_key, uc_key, right=False):
    ax, ay, _, _ = ACTORS[actor_key]
    ux, uy, rx, ry = UC[uc_key]
    x1 = ax + 22 if not right else ax - 22
    y1 = ay + 30
    x2 = ux - rx if not right else ux + rx
    LINKS.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{uy}" stroke="{LINE}" stroke-width="1.1"/>')


def dashed(from_key, to_key, label, dx=0, dy=-6):
    """Straight «include»/«extend» between neighbouring use cases."""
    fx, fy, frx, fry = UC[from_key]
    tx, ty, trx, tryy = UC[to_key]
    if fx == tx:
        y1 = fy + fry if ty > fy else fy - fry
        y2 = ty - tryy if ty > fy else ty + tryy
        LINKS.append(f'<line x1="{fx}" y1="{y1}" x2="{tx}" y2="{y2}" stroke="{LINE}" stroke-width="1.1" '
                     f'stroke-dasharray="6 4" marker-end="url(#arrow)"/>')
        mx, my, anchor = fx + 6, (y1 + y2) / 2, "start"
    else:
        x1 = fx + frx if tx > fx else fx - frx
        x2 = tx - trx if tx > fx else tx + trx
        LINKS.append(f'<line x1="{x1}" y1="{fy}" x2="{x2}" y2="{ty}" stroke="{LINE}" stroke-width="1.1" '
                     f'stroke-dasharray="6 4" marker-end="url(#arrow)"/>')
        mx, my, anchor = (x1 + x2) / 2, (fy + ty) / 2, "middle"
    LABELS.append(f'<text x="{mx+dx}" y="{my+dy}" text-anchor="{anchor}" font-size="10" font-style="italic" '
                  f'fill="{GOLD}">{label}</text>')


def dashed_arc(from_key, to_key, label, bow=95):
    """«include» routed clear of the column so it never runs through an ellipse."""
    fx, fy, frx, fry = UC[from_key]
    tx, ty, trx, tryy = UC[to_key]
    x1, x2 = fx + frx, tx + trx
    cx = max(x1, x2) + bow
    LINKS.append(f'<path d="M {x1} {fy} C {cx} {fy}, {cx} {ty}, {x2} {ty}" fill="none" stroke="{LINE}" '
                 f'stroke-width="1.1" stroke-dasharray="6 4" marker-end="url(#arrow)"/>')
    LABELS.append(f'<text x="{cx-14}" y="{(fy+ty)/2}" text-anchor="middle" font-size="10" font-style="italic" '
                  f'fill="{GOLD}">{label}</text>')


# officer
for uc in ("signin", "regclient", "viewclient", "apply", "preview", "repay", "opensav", "savtxn", "dash"):
    assoc("officer", uc)
# teller
for uc in ("signin", "viewclient", "repay", "savtxn", "dash"):
    assoc("teller", uc)
# manager
for uc in ("signin", "status", "dash", "reports"):
    assoc("manager", uc)
assoc("manager", "approve")
assoc("manager", "reject")
assoc("manager", "disburse")
# admin
for uc in ("signin", "staff", "audit", "reports", "writeoff"):
    assoc("admin", uc)

# external actors (connect from the right)
assoc("sms", "notify", right=True)
assoc("client", "receipt", right=True)

# include / extend relationships
dashed("disburse", "schedule", "&#171;include&#187;")
dashed("repay", "receipt", "&#171;include&#187;", dy=-9)
dashed("penalty", "repay", "&#171;extend&#187;", dy=-9)
dashed_arc("approve", "notify", "&#171;include&#187;", bow=70)
dashed_arc("disburse", "notify", "&#171;include&#187;", bow=115)

# legend
parts.append('<g transform="translate(250, 855)">'
             f'<line x1="0" y1="-4" x2="26" y2="-4" stroke="{LINE}" stroke-width="1.1"/>'
             f'<text x="32" y="0" font-size="10.5" fill="#5A6B66">association</text>'
             f'<line x1="120" y1="-4" x2="146" y2="-4" stroke="{LINE}" stroke-width="1.1" stroke-dasharray="6 4" marker-end="url(#arrow)"/>'
             f'<text x="152" y="0" font-size="10.5" fill="#5A6B66">include / extend</text>'
             '</g>')

parts.extend(LINKS)
parts.extend(SHAPES)
parts.extend(ACTOR_ART)
parts.extend(LABELS)
parts.append("</svg>")

with open("docs/diagrams/use-case-diagram.svg", "w") as fh:
    fh.write("\n".join(parts))
print("use-case-diagram.svg written:", len("\n".join(parts)), "bytes")
