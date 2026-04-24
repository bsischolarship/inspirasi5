/**
 * auth.js — zero-flicker auth untuk sidebar layout
 * Supports roles: admin, operator, lecture, user
 *
 * Role 'operator' = sama akses seperti admin tapi STRICT READ-ONLY:
 *   - Menu awardee disembunyikan (sama seperti lecture)
 *   - Allowlist interceptor: hanya handler aman (navigasi/download/detail/close)
 *     yang boleh jalan. Semua tombol lain diblokir di JS level.
 *   - CSS juga hide tombol-tombol write yang dikenal (cosmetic)
 */
let _authReadyResolve;
window._authReady = new Promise(res => { _authReadyResolve = res; });

// State flags untuk operator mode — dideklarasi SEBELUM IIFE agar tidak TDZ error
let _operatorStylesInjected = false;
let _operatorInterceptorAttached = false;

(async () => {
  const SUPABASE_URL      = "https://iyfwaqwmnmjfagszttts.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZndhcXdtbm1qZmFnc3p0dHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTEwMTgsImV4cCI6MjA4MzQyNzAxOH0.f2xb_aQDIj4tIPKwTTC9dgIi-9qFv0G252T5uo9XwXo";

  if (!window._supabase) {
    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  window._authClient = window._supabase;

  // Inject CSS untuk role operator sedini mungkin (sebelum render)
  _injectOperatorStyles();

  // ── RENDER SINKRON dari cache sessionStorage (zero flicker) ──
  const cached = _readCache();
  if (cached.email) {
    window._authName  = cached.name  || cached.email.split("@")[0];
    window._authEmail = cached.email;
    window._authNis   = cached.nis   || "";
    window._authRole  = cached.role  || "";
    _renderUI(cached.email, cached.name, cached.role, cached.nis || "", cached.kampus || "");
    _toggleRoleGroups(cached.role);
  }

  // ── VERIFY SESSION (async) ──
  const { data: { session } } = await window._authClient.auth.getSession();
  if (!session) { window.location.replace("login.html"); return; }

  window._authUser = session.user;
  const email = session.user.email || "";

  let role = cached.role;
  let displayName = cached.name;

  if (!role || !displayName) {
    const { data: prof } = await window._authClient
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    role        = prof?.role || "user";
    displayName = prof?.full_name || email.split("@")[0];

    if (role === "lecture") {
      try {
        const { data: lect } = await window._authClient
          .from("lecture_bsi")
          .select("nama_lengkap")
          .ilike("email", email)
          .maybeSingle();
        if (lect?.nama_lengkap) displayName = lect.nama_lengkap;
      } catch (e) { /* ignore */ }
    }

    _saveCache(email, displayName, role, cached.nis || "", cached.kampus || "");
  }

  window._authRole = role;

  let nis = cached.nis || "";
  let kampus = cached.kampus || "";
  if (role !== "admin" && role !== "operator" && role !== "lecture" && (!nis || !kampus) && displayName) {
    const { data: mhs } = await window._authClient
      .from("mahasiswa_bsi").select("no_induk, kampus").eq("nama", displayName).maybeSingle();
    if (mhs) {
      nis    = mhs.no_induk || "";
      kampus = mhs.kampus   || "";
      _saveCache(email, displayName, role, nis, kampus);
    }
  }

  window._authName  = displayName;
  window._authEmail = email;
  window._authNis   = nis;
  _renderUI(email, displayName, role, nis, kampus);
  _toggleRoleGroups(role);

  _authReadyResolve({ role, nis, name: displayName });
}

)();

function _readCache() {
  try { return JSON.parse(sessionStorage.getItem("_bsi_auth") || "{}"); } catch { return {}; }
}

function _saveCache(email, name, role, nis = "", kampus = "") {
  try { sessionStorage.setItem("_bsi_auth", JSON.stringify({ email, name, role, nis, kampus })); } catch {}
}

/* =========================================================================
   OPERATOR ALLOWLIST
   Handler names (function-name di onclick) yang boleh dijalankan operator.
   Semua yang TIDAK ada di sini akan diblokir oleh interceptor.
========================================================================= */
const OPERATOR_ALLOW_HANDLERS = new Set([
  // Navigasi / UI
  'toggleSidebar', 'closeSidebar', 'switchTab', 'scrollToMe',
  'authLogout',

  // Pagination
  'goPage', 'gotoPage',

  // Search / filter (hanya baca data)
  'resetFilter', 'filterPanel', 'filterTable', 'applyFilters', 'renderList',
  'runTalent', 'selectTalentCategory',

  // View detail — read-only modals
  'showDetail', 'openDetail', 'openAwardeeDetail', 'openAwardeeDetailForTalent',

  // Inline event guard — onclick="if(event.target===this)closeXXX()"
  'if',
]);
// Prefix yang selalu aman (close*, download*)
const OPERATOR_ALLOW_PREFIX = /^(close|download)/;

function _isOperatorAllowed(handlerName) {
  if (!handlerName) return true; // no handler → likely safe (e.g. href link)
  if (OPERATOR_ALLOW_HANDLERS.has(handlerName)) return true;
  if (OPERATOR_ALLOW_PREFIX.test(handlerName)) return true;
  return false;
}

function _injectOperatorStyles() {
  if (_operatorStylesInjected) return;
  _operatorStylesInjected = true;

  const css = `
/* =========================================================================
   OPERATOR ROLE — VISUAL HIDING (cosmetic, JS interceptor is the real gate)
========================================================================= */

/* Badge color operator (teal) */
.header-role-badge.badge-operator {
  background: #ccfbf1; color: #0d9488; border: 1px solid #99f6e4;
}

/* Hide write-action buttons via class patterns */
body[data-role="operator"] .btn-primary,
body[data-role="operator"] .btn-success,
body[data-role="operator"] .btn-danger,
body[data-role="operator"] .btn-confirm,
body[data-role="operator"] .btn-save,
body[data-role="operator"] .btn-sync,
body[data-role="operator"] .btn-add,
body[data-role="operator"] .btn-add-user,
body[data-role="operator"] .btn-approve,
body[data-role="operator"] .btn-reject,
body[data-role="operator"] .btn-revoke,
body[data-role="operator"] .btn-admin,
body[data-role="operator"] .btn-icon.edit,
body[data-role="operator"] .btn-icon.del,
body[data-role="operator"] .au-btn-submit,
/* onclick pattern hiding */
body[data-role="operator"] [onclick*="openAdd"],
body[data-role="operator"] [onclick*="openEdit"],
body[data-role="operator"] [onclick*="openChange"],
body[data-role="operator"] [onclick*="openModal"],
body[data-role="operator"] [onclick*="editAnn"],
body[data-role="operator"] [onclick*="deleteAnn"],
body[data-role="operator"] [onclick*="delRow"],
body[data-role="operator"] [onclick*="addForm"],
body[data-role="operator"] [onclick^="submit"],
body[data-role="operator"] [onclick^="save"],
body[data-role="operator"] [onclick*="approveUser"],
body[data-role="operator"] [onclick*="rejectUser"],
body[data-role="operator"] [onclick*="revokeUser"],
body[data-role="operator"] [onclick*="revokeOtherSessions"],
body[data-role="operator"] [onclick*="toggleActive"],
body[data-role="operator"] [onclick*="togglePin"],
body[data-role="operator"] [onclick*="bulkDelete"],
body[data-role="operator"] [onclick*="resetPassword"],
body[data-role="operator"] input[type="submit"],
body[data-role="operator"] button[type="submit"] {
  display: none !important;
}

/* Pengecualian: download buttons TETAP tampil walau punya btn-primary/btn-success */
body[data-role="operator"] [onclick^="download"],
body[data-role="operator"] .btn-dl,
body[data-role="operator"] .btn-gold {
  display: inline-flex !important;
}

/* Disable semua input editable (tidak bisa diubah) */
body[data-role="operator"] .app-content input:not([type="button"]):not([type="submit"]):not([readonly]):not([disabled]),
body[data-role="operator"] .app-content textarea:not([readonly]):not([disabled]),
body[data-role="operator"] .app-content select:not([disabled]) {
  pointer-events: none;
  background-color: #f9fafb !important;
  color: #6b7280 !important;
  cursor: not-allowed;
}
/* ...kecuali search/filter (diperlukan untuk explore data) */
body[data-role="operator"] .app-content input[type="search"],
body[data-role="operator"] .app-content input[placeholder*="Cari" i],
body[data-role="operator"] .app-content input[placeholder*="Search" i],
body[data-role="operator"] .app-content .tbl-search input,
body[data-role="operator"] .app-content .tbl-filter,
body[data-role="operator"] .app-content .lb-filter,
body[data-role="operator"] .app-content .lb-filter-search {
  pointer-events: auto !important;
  background-color: #fff !important;
  color: #374151 !important;
  cursor: text;
}

/* Hide kolom aksi kalau ditandai */
body[data-role="operator"] th.col-aksi,
body[data-role="operator"] td.col-aksi,
body[data-role="operator"] .row-actions {
  display: none !important;
}

/* Disable toggle switches (admin-forms activate, admin-settings preferences, dll.) */
body[data-role="operator"] label.toggle,
body[data-role="operator"] .toggle-wrap label.toggle {
  pointer-events: none !important;
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.4);
}
`;
  const styleEl = document.createElement('style');
  styleEl.id = 'operator-mode-css';
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);
}

// Safety net via event interceptor: blokir handler yang tidak ada di allowlist
function _attachOperatorInterceptor() {
  if (_operatorInterceptorAttached) return;
  _operatorInterceptorAttached = true;

  // Click interceptor — capture phase agar jalan duluan sebelum inline onclick
  document.addEventListener('click', (e) => {
    if (window._authRole !== 'operator') return;

    const el = e.target.closest('[onclick]');
    if (!el) return;

    const raw = el.getAttribute('onclick') || '';
    // Ekstrak nama fungsi pertama (e.g. "foo()" → "foo", "if(...)bar()" → "if")
    const m = raw.match(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    const fnName = m ? m[1] : '';

    if (_isOperatorAllowed(fnName)) return; // allowed

    // Blokir
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }, true);

  // Form submit interceptor
  document.addEventListener('submit', (e) => {
    if (window._authRole !== 'operator') return;
    const form = e.target;
    // Abaikan search forms
    if (form.querySelector('input[type="search"]') || form.getAttribute('role') === 'search') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }, true);

  // Change interceptor — untuk onchange handlers (toggle checkbox, select dropdown write)
  document.addEventListener('change', (e) => {
    if (window._authRole !== 'operator') return;
    const el = e.target.closest('[onchange]');
    if (!el) return;

    const raw = el.getAttribute('onchange') || '';
    const m = raw.match(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    const fnName = m ? m[1] : '';

    if (_isOperatorAllowed(fnName)) return; // allowed (filter/search)

    // Blokir + revert state checkbox/radio
    e.preventDefault();
    e.stopImmediatePropagation();
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !el.checked;
    }
    return false;
  }, true);
}

// Toggle sidebar groups + mobile nav based on role
function _toggleRoleGroups(role) {
  const adminGroup   = document.getElementById("adminGroup");
  const lectureGroup = document.getElementById("lectureGroup");
  const mobAdmin     = document.getElementById("mobNavAdmin");
  const mobLecture   = document.getElementById("mobNavLecture");

  // Set body data-role untuk CSS targeting
  if (document.body) document.body.dataset.role = role || '';

  // Portal Admin: visible untuk admin & operator
  // Portal Lecture: visible untuk lecture, admin, & operator
  const showAdmin   = (role === "admin" || role === "operator");
  const showLecture = (role === "lecture" || role === "admin" || role === "operator");

  if (adminGroup)   adminGroup.style.display   = showAdmin   ? "block" : "none";
  if (lectureGroup) lectureGroup.style.display = showLecture ? "block" : "none";
  if (mobAdmin)     mobAdmin.style.display     = showAdmin   ? "flex"  : "none";
  if (mobLecture)   mobLecture.style.display   = showLecture ? "flex"  : "none";

  // Menu awardee yang disembunyikan untuk lecture & operator (selain Home):
  //   List Form, Rekap, Lapor, Galeri, Form
  // Home (index.html) → SELALU tampil untuk semua role:
  //   user → tampilan awardee personal
  //   admin/operator/lecture → tampilan global (data agregat semua awardee)
  const AWARDEE_NONHOME = ['list-form.html', 'rekap.html', 'lapor.html', 'galeri.html', 'form.html'];
  const hideNonHome = (role === 'lecture' || role === 'operator');

  AWARDEE_NONHOME.forEach(h => {
    document.querySelectorAll(`a[href="${h}"]`).forEach(a => {
      if (a.closest('#lectureGroup') || a.closest('#adminGroup')) return;
      a.style.display = hideNonHome ? 'none' : '';
    });
  });
  // Home link: pastikan tampil untuk semua role
  document.querySelectorAll(`a[href="index.html"]`).forEach(a => {
    if (a.closest('#lectureGroup') || a.closest('#adminGroup')) return;
    a.style.display = '';
  });

  // Label "Menu" → selalu tampil karena Home selalu visible
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const labels = sidebar.querySelectorAll('.sidebar-section-label');
    labels.forEach(lbl => {
      const txt = (lbl.textContent || '').trim();
      if (/^Menu$/i.test(txt)) {
        lbl.style.display = '';
      }
    });
  }

  // Operator: attach click/submit/change interceptor
  if (role === 'operator') {
    _attachOperatorInterceptor();
  }
}

function _roleLabel(role) {
  if (role === "admin")    return "Administrator";
  if (role === "operator") return "Operator";
  if (role === "lecture")  return "Lecture";
  return "Awardee";
}

function _renderUI(email, name, role, nis = "", kampus = "") {
  const displayName = name || email.split("@")[0];
  const nameParts = displayName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  const hAvatar   = document.getElementById("headerAvatar");
  const hGreeting = document.getElementById("headerGreeting");
  const hName     = document.getElementById("headerName");
  const hBadge    = document.getElementById("headerRoleBadge");
  const hSub      = document.getElementById("headerSubInfo");

  if (hAvatar) hAvatar.textContent = initials;
  if (hGreeting) hGreeting.textContent = "Selamat Datang,";
  if (hName)   hName.textContent   = displayName;
  if (hBadge) {
    hBadge.textContent = _roleLabel(role);
    let cls = "header-role-badge";
    if (role === "admin")    cls += " badge-admin";
    if (role === "operator") cls += " badge-operator";
    if (role === "lecture")  cls += " badge-lecture";
    hBadge.className = cls;
  }
  if (hSub) {
    if (role !== "admin" && role !== "operator" && role !== "lecture" && (nis || kampus)) {
      hSub.textContent = [nis, kampus].filter(Boolean).join(" · ");
      hSub.style.display = "block";
    } else {
      hSub.style.display = "none";
    }
  }

  const sAvatar = document.getElementById("sidebarAvatar");
  const sEmail  = document.getElementById("sidebarEmail");
  const sRole   = document.getElementById("sidebarRole");
  if (sAvatar) sAvatar.textContent = initials;
  if (sEmail)  sEmail.textContent  = displayName;
  if (sRole)   sRole.textContent   = _roleLabel(role);

  _toggleRoleGroups(role);
}

async function authLogout() {
  sessionStorage.removeItem("_bsi_auth");
  await window._authClient.auth.signOut();
  window.location.replace("login.html");
}