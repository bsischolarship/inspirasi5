/**
 * auth.js — zero-flicker auth untuk sidebar layout
 * Supports roles: admin, lecture, user
 *
 * Untuk role 'lecture', nama otoritatif diambil dari lecture_bsi.nama_lengkap
 * yang ditautkan via email akun (lecture_bsi.email ilike auth.email).
 */
let _authReadyResolve;
window._authReady = new Promise(res => { _authReadyResolve = res; });

(async () => {
  const SUPABASE_URL      = "https://iyfwaqwmnmjfagszttts.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZndhcXdtbm1qZmFnc3p0dHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTEwMTgsImV4cCI6MjA4MzQyNzAxOH0.f2xb_aQDIj4tIPKwTTC9dgIi-9qFv0G252T5uo9XwXo";

  if (!window._supabase) {
    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  window._authClient = window._supabase;

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

  // Gunakan cache role jika sudah ada, hindari query ulang tiap navigasi
  let role = cached.role;
  let displayName = cached.name;

  if (!role || !displayName) {
    const { data: prof } = await window._authClient
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    role        = prof?.role || "user";
    displayName = prof?.full_name || email.split("@")[0];

    // Untuk role lecture, ambil nama_lengkap otoritatif dari lecture_bsi (ditautkan via email)
    if (role === "lecture") {
      try {
        const { data: lect } = await window._authClient
          .from("lecture_bsi")
          .select("nama_lengkap")
          .ilike("email", email)
          .maybeSingle();
        if (lect?.nama_lengkap) displayName = lect.nama_lengkap;
      } catch (e) { /* ignore, fallback to profiles.full_name */ }
    }

    _saveCache(email, displayName, role, cached.nis || "", cached.kampus || "");
  }

  window._authRole = role;

  // For awardees (role 'user'): fetch NIS + kampus from mahasiswa_bsi
  // Admin & lecture tidak perlu NIS lookup
  let nis = cached.nis || "";
  let kampus = cached.kampus || "";
  if (role !== "admin" && role !== "lecture" && (!nis || !kampus) && displayName) {
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

// Toggle sidebar groups + mobile nav based on role
function _toggleRoleGroups(role) {
  const adminGroup   = document.getElementById("adminGroup");
  const lectureGroup = document.getElementById("lectureGroup");
  const mobAdmin     = document.getElementById("mobNavAdmin");
  const mobLecture   = document.getElementById("mobNavLecture");

  if (role === "admin") {
    if (adminGroup)   adminGroup.style.display   = "block";
    if (lectureGroup) lectureGroup.style.display = "none";
    if (mobAdmin)     mobAdmin.style.display     = "flex";
    if (mobLecture)   mobLecture.style.display   = "none";
  } else if (role === "lecture") {
    if (lectureGroup) lectureGroup.style.display = "block";
    if (adminGroup)   adminGroup.style.display   = "none";
    if (mobLecture)   mobLecture.style.display   = "flex";
    if (mobAdmin)     mobAdmin.style.display     = "none";
  } else {
    if (adminGroup)   adminGroup.style.display   = "none";
    if (lectureGroup) lectureGroup.style.display = "none";
    if (mobAdmin)     mobAdmin.style.display     = "none";
    if (mobLecture)   mobLecture.style.display   = "none";
  }

  // Awardee-only menu items: sembunyikan untuk role 'lecture'
  // (mereka hanya butuh Portal Lecture + Profil)
  const AWARDEE_HREFS = ['index.html', 'list-form.html', 'rekap.html', 'lapor.html', 'galeri.html', 'form.html'];
  const sel = AWARDEE_HREFS.map(h => `a[href="${h}"]`).join(', ');
  const hideAwardee = (role === 'lecture');
  document.querySelectorAll(sel).forEach(a => {
    // Jangan sentuh link di dalam lectureGroup/adminGroup (mereka punya aturan sendiri)
    if (a.closest('#lectureGroup') || a.closest('#adminGroup')) return;
    a.style.display = hideAwardee ? 'none' : '';
  });

  // Label "Menu" di sidebar — hide untuk lecture (karena semua item Menu disembunyikan)
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const labels = sidebar.querySelectorAll('.sidebar-section-label');
    labels.forEach(lbl => {
      const txt = (lbl.textContent || '').trim();
      // Hanya target label "Menu" (bukan "Portal Lecture"/"Portal Admin")
      if (/^Menu$/i.test(txt)) {
        lbl.style.display = hideAwardee ? 'none' : '';
      }
    });
  }
}

function _roleLabel(role) {
  if (role === "admin")   return "Administrator";
  if (role === "lecture") return "Lecture";
  return "Awardee";
}

function _renderUI(email, name, role, nis = "", kampus = "") {
  const displayName = name || email.split("@")[0];
  const nameParts = displayName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  // Header
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
    if (role === "admin")   cls += " badge-admin";
    if (role === "lecture") cls += " badge-lecture";
    hBadge.className = cls;
  }
  if (hSub) {
    if (role !== "admin" && role !== "lecture" && (nis || kampus)) {
      hSub.textContent = [nis, kampus].filter(Boolean).join(" · ");
      hSub.style.display = "block";
    } else {
      hSub.style.display = "none";
    }
  }

  // Sidebar footer
  const sAvatar = document.getElementById("sidebarAvatar");
  const sEmail  = document.getElementById("sidebarEmail");
  const sRole   = document.getElementById("sidebarRole");
  if (sAvatar) sAvatar.textContent = initials;
  if (sEmail)  sEmail.textContent  = displayName;
  if (sRole)   sRole.textContent   = _roleLabel(role);

  // Re-apply role group toggle (safety net for cached render path)
  _toggleRoleGroups(role);
}

async function authLogout() {
  sessionStorage.removeItem("_bsi_auth");
  await window._authClient.auth.signOut();
  window.location.replace("login.html");
}