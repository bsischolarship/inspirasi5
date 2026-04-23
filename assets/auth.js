/**
 * auth.js — zero-flicker auth untuk sidebar layout
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
    // Langsung tampilkan admin link di sidebar + mobile nav dari cache
    if (cached.role === "admin") {
      const ag = document.getElementById("adminGroup");
      if (ag) ag.style.display = "block";
      const mobAdmin = document.getElementById("mobNavAdmin");
      if (mobAdmin) mobAdmin.style.display = "flex";
    }
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
    _saveCache(email, displayName, role, cached.nis || "", cached.kampus || "");
  }

  window._authRole = role;

  // For awardees: fetch NIS + kampus from mahasiswa_bsi
  let nis = cached.nis || "";
  let kampus = cached.kampus || "";
  if (role !== "admin" && (!nis || !kampus) && displayName) {
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

  // Admin link (sidebar + mobile nav)
  if (role === "admin") {
    const ag = document.getElementById("adminGroup");
    if (ag) ag.style.display = "block";
    const mobAdmin = document.getElementById("mobNavAdmin");
    if (mobAdmin) mobAdmin.style.display = "flex";
  }

  _authReadyResolve({ role, nis, name: displayName });
}

)();

function _readCache() {
  try { return JSON.parse(sessionStorage.getItem("_bsi_auth") || "{}"); } catch { return {}; }
}

function _saveCache(email, name, role, nis = "", kampus = "") {
  try { sessionStorage.setItem("_bsi_auth", JSON.stringify({ email, name, role, nis, kampus })); } catch {}
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
    hBadge.textContent = role === "admin" ? "Administrator" : "Awardee";
    hBadge.className   = "header-role-badge" + (role === "admin" ? " badge-admin" : "");
  }
  if (hSub) {
    if (role !== "admin" && (nis || kampus)) {
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
  if (sRole)   sRole.textContent   = role === "admin" ? "Administrator" : "Awardee";

  // Admin link (sinkron dari cache)
  if (role === "admin") {
    const ag = document.getElementById("adminGroup");
    if (ag) ag.style.display = "block";
  }
}

async function authLogout() {
  sessionStorage.removeItem("_bsi_auth");
  await window._authClient.auth.signOut();
  window.location.replace("login.html");
}
