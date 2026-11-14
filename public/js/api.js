/* =====================================================================
   api.js — one place that talks to the server, plus the shared UI helpers
   every page uses (layout, formatting, toasts, modals).
   ===================================================================== */

const API_BASE = '/api';
const TOKEN_KEY = 'mfms.token';
const USER_KEY = 'mfms.user';

/* ---------- session ---------------------------------------------------- */
const Session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  save(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); },
  can(...roles) { const u = Session.user; return !!u && roles.includes(u.role); },
};

/* ---------- HTTP ------------------------------------------------------- */
class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || null;
  }
}

async function request(method, path, body) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (Session.token) options.headers.Authorization = `Bearer ${Session.token}`;
  if (body !== undefined) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch {
    throw new ApiError('The server is not responding. Check that it is running on port 4000.', 0);
  }

  if (response.status === 401 && !path.includes('/auth/login')) {
    Session.clear();
    window.location.href = '/index.html';
    throw new ApiError('Session expired', 401);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.message || 'Request failed', response.status, payload.errors);
  return payload;
}

const Api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p),
};

/* ---------- formatting -------------------------------------------------- */
const fmt = {
  money(value) {
    const n = Number(value || 0);
    return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  compact(value) {
    const n = Number(value || 0);
    if (Math.abs(n) >= 1e6) return `R${(n / 1e6).toFixed(2)}m`;
    if (Math.abs(n) >= 1e3) return `R${(n / 1e3).toFixed(1)}k`;
    return `R${n.toFixed(0)}`;
  },
  date(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  dateInput(value) {
    const d = value ? new Date(value) : new Date();
    return d.toISOString().slice(0, 10);
  },
  pct(n) { return `${Number(n || 0).toFixed(1)}%`; },
  title(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); },
};

/** Escapes anything that came from the database before it reaches innerHTML. */
function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STATUS_PILL = {
  active: 'is-ok', closed: 'is-mute', pending: 'is-gold', approved: '',
  rejected: 'is-rust', defaulted: 'is-rust', written_off: 'is-rust',
  overdue: 'is-rust', paid: 'is-ok', partial: 'is-gold', inactive: 'is-mute',
  blacklisted: 'is-rust', dormant: 'is-mute', queued: 'is-gold', sent: 'is-ok',
};
function pill(status) {
  return `<span class="pill ${STATUS_PILL[status] || ''}">${esc(fmt.title(status))}</span>`;
}

/* ---------- toasts ------------------------------------------------------ */
function toast(message, kind = 'good') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast${kind === 'bad' ? ' is-bad' : ''}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/** Puts server-side validation messages next to the fields they belong to. */
function showFieldErrors(form, errors) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  if (!errors) return;
  Object.entries(errors).forEach(([name, message]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    const field = input.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    let err = field.querySelector('.err');
    if (!err) { err = document.createElement('div'); err.className = 'err'; field.appendChild(err); }
    err.textContent = message;
  });
}

function formData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (value !== '') data[key] = value;
  });
  return data;
}

/* ---------- overlay helpers --------------------------------------------- */
function openOverlay(id) { document.getElementById(id).classList.add('is-open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('is-open'); }
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('overlay')) e.target.classList.remove('is-open');
  if (e.target.dataset && e.target.dataset.close) closeOverlay(e.target.dataset.close);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay.is-open').forEach((o) => o.classList.remove('is-open'));
});

/* ---------- navigation rail ---------------------------------------------- */
const NAV = [
  { label: 'Daily work', items: [
    { href: 'dashboard.html', text: 'Dashboard' },
    { href: 'clients.html', text: 'Clients' },
    { href: 'loans.html', text: 'Loans' },
    { href: 'repayments.html', text: 'Repayments' },
    { href: 'savings.html', text: 'Savings' },
    { href: 'insurance.html', text: 'Insurance' },
  ] },
  { label: 'Oversight', items: [
    { href: 'reports.html', text: 'Reports' },
    { href: 'users.html', text: 'Staff & access', roles: ['admin'] },
  ] },
];

function renderShell() {
  const user = Session.user;
  if (!user) { window.location.href = '/index.html'; return; }

  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  const groups = NAV.map((group) => {
    const links = group.items
      .filter((i) => !i.roles || i.roles.includes(user.role))
      .map((i) => `<a href="${i.href}" class="${i.href === current ? 'is-current' : ''}">${i.text}</a>`)
      .join('');
    return links ? `<span class="rail-label">${group.label}</span>${links}` : '';
  }).join('');

  const rail = document.querySelector('.rail');
  rail.innerHTML = `
    <a class="rail-brand" href="dashboard.html">
      <img src="img/khupfin-wordmark-light.png" alt="KhupFin" width="640" height="114">
      <span>Microfinance Ledger</span>
    </a>
    <nav class="rail-nav">${groups}</nav>
    <div class="rail-foot">
      <div class="who">${esc(user.full_name)}</div>
      <div class="role">${esc(user.role)}</div>
      <button type="button" id="signOut">Sign out</button>
    </div>`;

  document.getElementById('signOut').addEventListener('click', () => {
    Session.clear();
    window.location.href = '/index.html';
  });
}

/** Every protected page calls this first. */
function bootPage(loader) {
  if (!Session.token) { window.location.href = '/index.html'; return; }
  renderShell();
  Promise.resolve(loader()).catch((err) => toast(err.message, 'bad'));
}

function emptyRow(colspan, title, hint) {
  return `<tr><td colspan="${colspan}" class="empty"><strong>${esc(title)}</strong>${hint ? esc(hint) : ''}</td></tr>`;
}
