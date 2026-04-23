/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL = "https://iyfwaqwmnmjfagszttts.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZndhcXdtbm1qZmFnc3p0dHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTEwMTgsImV4cCI6MjA4MzQyNzAxOH0.f2xb_aQDIj4tIPKwTTC9dgIi-9qFv0G252T5uo9XwXo";

// Gunakan satu instance global agar tidak ada multiple GoTrueClient
if (!window._supabase) {
  window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const supabaseClient = window._supabase;
window.supabaseClient = window._supabase;

/* =========================================================
   GLOBAL STATE
========================================================= */

let mahasiswaData = null;
let formsConfig = null;


/* =========================================================
   LOAD DATA FROM SUPABASE
========================================================= */

async function ensureDataLoaded() {
    if (mahasiswaData) return;

    // Fetch semua data bypass limit 1000
    let allRows = [], from = 0, batchSize = 1000;
    while (true) {
        const { data, error } = await supabaseClient
            .from("mahasiswa_bsi")
            .select("no_induk, nama, kampus, kelompok, status")
            .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
    }
    const data = allRows;
    if (!data) throw new Error("No data");

    mahasiswaData = (data || []).map((m) => ({
        nim: String(m.no_induk || "").trim(),
        nama: m.nama || "",
        kampus: m.kampus || "",
        kelompok: m.kelompok || ""
    }));
}

/* =========================================================
   BANNER MONTH
========================================================= */

function setBannerMonthIfExists() {
    const el = document.getElementById("alert-month");
    if (!el) return;

    const now = new Date();
    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    el.textContent = ` (Periode bulan ${monthNames[now.getMonth()]} ${now.getFullYear()})`;
}

/* =========================================================
   INIT FORM PAGE
========================================================= */

async function initFormPage(slug) {
    setBannerMonthIfExists();

    // Cek apakah form ini aktif
    const cfg = formsConfig && formsConfig[slug];
    if (cfg && cfg.is_active === false) {
        _showFormInactive();
        return;
    }

    // Cek session langsung via supabaseClient (sudah tersedia di main.js)
    let session = null;
    try {
        const { data } = await supabaseClient.auth.getSession();
        session = data.session;
    } catch (_) {}

    if (!session || !session.user) {
        // Belum login — tampilkan form input manual
        await ensureDataLoaded();
        _showFormInput();
        return;
    }

    const email = session.user.email;

    // Query data awardee berdasarkan email
    let mhs = null;
    try {
        const { data } = await supabaseClient
            .from('mahasiswa_bsi')
            .select('no_induk, nama, kampus, kelompok')
            .ilike('email', email)
            .maybeSingle();
        mhs = data;
    } catch (_) {}

    if (!mhs) {
        // Email tidak ada di mahasiswa_bsi (admin / tamu) — form manual
        await ensureDataLoaded();
        _showFormInput();
        return;
    }

    const found = {
        nim:      String(mhs.no_induk || '').trim(),
        nama:     mhs.nama     || '',
        kampus:   mhs.kampus   || '',
        kelompok: mhs.kelompok || '',
    };

    const banner = document.getElementById('form-banner');
    if (banner) banner.style.display = 'none';

    showVerificationCard(found, slug);
}

function _showFormInput() {
    [
        document.getElementById('section-input'),
        document.querySelector('.nim-form'),
        document.getElementById('form-banner'),
    ].forEach(el => {
        if (!el) return;
        el.style.cssText = 'visibility:visible;opacity:0;pointer-events:auto;transition:opacity .3s ease';
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
    });
}

function _showFormInactive() {
    // Sembunyikan semua elemen form
    ['section-input', 'form-banner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const nimForm = document.querySelector('.nim-form');
    if (nimForm) nimForm.style.display = 'none';

    // Tampilkan banner nonaktif
    const main = document.querySelector('main.page') || document.querySelector('main') || document.body;
    const banner = document.createElement('div');
    banner.style.cssText = 'max-width:480px;margin:60px auto;text-align:center;padding:40px 24px;background:#fff;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,.08);';
    banner.innerHTML = `
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" style="margin-bottom:16px">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px">Form Sedang Tidak Aktif</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:24px">Form ini sedang dinonaktifkan oleh admin. Coba lagi nanti atau hubungi panitia.</div>
        <a href="list-form.html" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:#0055a5;color:#fff;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Kembali ke List Form
        </a>`;
    main.prepend(banner);
}

/* ── Tampilkan kartu verifikasi & tombol buka form ── */
function showVerificationCard(found, slug) {
    // Sembunyikan semua form input
    const sectionInput = document.getElementById('section-input');
    const nimForm      = document.querySelector('.nim-form');
    if (sectionInput) sectionInput.style.display = 'none';
    if (nimForm)      nimForm.style.display       = 'none';

    const cfg = formsConfig && formsConfig[slug];
    if (!cfg || !cfg.form_url) return;

    const params = new URLSearchParams();
    if (cfg.prefill && cfg.prefill.nim)      params.set(cfg.prefill.nim,      found.nim);
    if (cfg.prefill && cfg.prefill.nama)     params.set(cfg.prefill.nama,     found.nama);
    if (cfg.prefill && cfg.prefill.kampus)   params.set(cfg.prefill.kampus,   found.kampus);
    if (cfg.prefill && cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, found.kelompok);
    const finalUrl = cfg.form_url.includes('?')
        ? `${cfg.form_url}&${params.toString()}`
        : `${cfg.form_url}?${params.toString()}`;

    window._formFinalUrl = finalUrl;

    const initials = (found.nama || '??').slice(0, 2).toUpperCase();
    const cardHtml = `
        <div class="form-card-reveal" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:18px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <div style="width:44px;height:44px;border-radius:50%;background:#00A59F;color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
                <div>
                    <div style="font-size:15px;font-weight:700;color:#111827;">${found.nama || '—'}</div>
                    <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#6b7280;margin-top:2px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${found.kampus || '—'}
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
                <div style="background:#fff;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb;">
                    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:2px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                        Nomor Induk
                    </div>
                    <div style="font-size:13px;font-weight:700;color:#111827;font-family:monospace;">${found.nim || '—'}</div>
                </div>
                <div style="background:#fff;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb;">
                    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:2px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Kelompok
                    </div>
                    <div style="font-size:13px;font-weight:700;color:#111827;">${found.kelompok || '—'}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button onclick="openInlineForm()" id="btn-open-form"
                   style="display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 8px;background:#00A59F;color:#fff;border-radius:12px;font-size:13px;font-weight:700;border:none;cursor:pointer;box-sizing:border-box;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                    Buka di Sini
                </button>
                <a href="${finalUrl}" target="_blank" rel="noopener"
                   style="display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 8px;background:#fff;color:#00A59F;border:1.5px solid #00A59F;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;box-sizing:border-box;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Tab Baru
                </a>
            </div>
        </div>
        <div id="inline-form-wrap" style="max-height:0;overflow:hidden;transition:max-height .5s cubic-bezier(.4,0,.2,1),opacity .4s ease;opacity:0;">
            <div style="border-radius:14px;overflow:hidden;border:1.5px solid #86efac;margin-top:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f0fdf4;border-bottom:1px solid #86efac;">
                    <span style="font-size:12px;font-weight:600;color:#059669;">Google Form</span>
                    <button onclick="closeInlineForm()" style="background:none;border:none;cursor:pointer;color:#6b7280;display:flex;align-items:center;padding:2px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <iframe id="inline-gform" src="" style="width:100%;height:680px;border:none;display:block;" loading="lazy" allow="autoplay"></iframe>
            </div>
        </div>`;

    // Render ke #cek-result jika ada, otherwise ke section-validation lama
    const cekResult = document.getElementById('cek-result');
    const sectionVal = document.getElementById('section-validation');

    if (cekResult) {
        cekResult.innerHTML = cardHtml;
    } else if (sectionVal) {
        sectionVal.innerHTML = cardHtml;
        sectionVal.style.display = 'block';
    }
}

function openInlineForm() {
    const wrap = document.getElementById('inline-form-wrap');
    const iframe = document.getElementById('inline-gform');
    const btn = document.getElementById('btn-open-form');
    if (!wrap || !iframe) return;
    if (!iframe.src || iframe.src === window.location.href) {
        iframe.src = window._formFinalUrl || '';
    }
    wrap.style.maxHeight = '760px';
    wrap.style.opacity = '1';
    if (btn) btn.style.display = 'none';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeInlineForm() {
    const wrap = document.getElementById('inline-form-wrap');
    const btn = document.getElementById('btn-open-form');
    if (!wrap) return;
    wrap.style.maxHeight = '0';
    wrap.style.opacity = '0';
    if (btn) btn.style.display = 'flex';
}

function goToGoogleForm() {
    if (window._formFinalUrl) window.open(window._formFinalUrl, '_blank');
}

function cancelVerification() {
    const cekResult  = document.getElementById('cek-result');
    const sectionVal = document.getElementById('section-validation');
    const sectionInput = document.getElementById('section-input');
    const nimForm    = document.querySelector('.nim-form');
    if (cekResult)  cekResult.innerHTML = '';
    if (sectionVal) sectionVal.style.display = 'none';
    if (sectionInput) sectionInput.style.display = 'block';
    if (nimForm)    nimForm.style.display = 'block';
}

/* ── Untuk form manual (fallback non-login) ── */
async function handleVerification(event) {
    event.preventDefault();
    const slug     = document.body.dataset.formSlug;
    const nimInput = document.getElementById('nim');
    if (!nimInput) return false;
    const query = (nimInput.value || '').trim();
    if (!query) return false;

    await ensureDataLoaded();
    const found = mahasiswaData.find(m =>
        m.nim.toLowerCase() === query.toLowerCase() ||
        m.nama.toLowerCase().includes(query.toLowerCase())
    );
    if (!found) {
        alert('Data tidak ditemukan. Coba nama atau NIM yang lebih spesifik.');
        return false;
    }
    showVerificationCard(found, slug);
    return false;
}

/* =========================================================
   HANDLE FORM SUBMIT (VERIFIKASI SUPABASE)
========================================================= */

async function handleFormSubmit(event) {
    event.preventDefault();

    const body = document.body;
    const slug = body.dataset.formSlug;
    const nimInput = document.getElementById("nim");
    const resultEl = document.getElementById("cek-result");

    if (!nimInput || !resultEl) return false;

    const nim = (nimInput.value || "").trim();

    if (!nim) {
        resultEl.innerHTML = `
            <div class="error-box">
                Nomor Induk tidak boleh kosong.
            </div>
        `;
        return false;
    }

    const supabase = window.supabaseClient;
    if (!supabase) {
        resultEl.innerHTML = `
            <div class="error-box">
                Koneksi database tidak tersedia.
            </div>
        `;
        return false;
    }

    /* ---- QUERY DATA MAHASISWA ---- */
    const { data, error } = await supabase
        .from("mahasiswa_bsi")
        .select("no_induk, nama, kampus, kelompok, status")
        .ilike("no_induk", nim)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Supabase error:", error);
        resultEl.innerHTML = `
            <div class="error-box">
                Terjadi kesalahan saat verifikasi data.
                Silakan coba lagi.
            </div>
        `;
        return false;
    }

    if (!data) {
        resultEl.innerHTML = `
            <div class="error-box">
                No Induk <strong>${nim}</strong> tidak ditemukan.
                Pastikan data benar atau hubungi admin.
            </div>
        `;
        return false;
    }

    /* ---- NORMALISASI DATA ---- */
    const found = {
        nim: String(data.no_induk || "").trim(),
        nama: data.nama || "",
        kampus: data.kampus || "",
        kelompok: data.kelompok || "",
        status: data.status || ""
    };

    /* ---- FORM CONFIG ---- */
    const cfg = formsConfig && formsConfig[slug];
    if (!cfg || !cfg.form_url || !cfg.prefill) {
        resultEl.innerHTML = `
            <div class="error-box">
                Konfigurasi form belum lengkap.
            </div>
        `;
        return false;
    }

    /* ---- BUILD PREFILL URL ---- */
    const params = new URLSearchParams();
    if (cfg.prefill.nim) params.set(cfg.prefill.nim, found.nim);
    if (cfg.prefill.nama) params.set(cfg.prefill.nama, found.nama);
    if (cfg.prefill.kampus) params.set(cfg.prefill.kampus, found.kampus);
    if (cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, found.kelompok);

    const finalUrl = cfg.form_url.includes("?")
        ? `${cfg.form_url}&${params.toString()}`
        : `${cfg.form_url}?${params.toString()}`;

    /* ---- RESULT UI ---- */
    resultEl.innerHTML = `
        <div class="result-card">
            <p><strong>Identitas ditemukan:</strong></p>

            <div class="result-table">
                <div class="label">No Induk</div><div class="colon">:</div><div class="value">${found.nim}</div>
                <div class="label">Nama</div><div class="colon">:</div><div class="value value--bold">${found.nama || "-"}</div>
                <div class="label">Kampus</div><div class="colon">:</div><div class="value">${found.kampus || "-"}</div>
                <div class="label">Kelompok</div><div class="colon">:</div><div class="value">${found.kelompok || "-"}</div>
            </div>

            <br/>
            <a class="btn btn-primary btn-full"
               href="${finalUrl}"
               target="_blank"
               rel="noopener">
                Buka Google Form &amp; Lanjutkan →
            </a>
        </div>
    `;

    return false;
}


/* =========================================================
   CHANGE NUMBER PAGE
========================================================= */

async function handleChangeNumber(event) {
    event.preventDefault();

    const nimInput = document.getElementById("nim-change");
    const resultEl = document.getElementById("change-number-result");

    if (!nimInput || !resultEl) return false;

    const nim = (nimInput.value || "").trim();

    if (!nim) {
        resultEl.innerHTML = `
            <div class="error-box">
                Nomor Induk tidak boleh kosong.
            </div>
        `;
        return false;
    }

    try {
        await ensureDataLoaded();
    } catch (err) {
        console.error(err);
        resultEl.innerHTML = `
            <div class="error-box">
                Gagal memuat data mahasiswa.
            </div>
        `;
        return false;
    }

    const found = mahasiswaData.find(
        (m) => m.nim.toUpperCase() === nim.toUpperCase()
    );

    if (!found) {
        resultEl.innerHTML = `
            <div class="error-box">
                No Induk <strong>${nim}</strong> tidak ditemukan.
            </div>
        `;
        return false;
    }

    const cfg = formsConfig && formsConfig["lapor"];
    if (!cfg || !cfg.form_url || !cfg.prefill) {
        resultEl.innerHTML = `
            <div class="error-box">
                Konfigurasi form lapor belum lengkap.
            </div>
        `;
        return false;
    }

    const params = new URLSearchParams();
    if (cfg.prefill.nim) params.set(cfg.prefill.nim, found.nim);
    if (cfg.prefill.nama) params.set(cfg.prefill.nama, found.nama);
    if (cfg.prefill.kampus) params.set(cfg.prefill.kampus, found.kampus);
    if (cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, found.kelompok);

    const finalUrl = cfg.form_url.includes("?")
        ? `${cfg.form_url}&${params.toString()}`
        : `${cfg.form_url}?${params.toString()}`;

    resultEl.innerHTML = `
        <div class="result-card">
            <p>Data ditemukan.</p>
            <a class="btn btn-primary btn-full"
               href="${finalUrl}"
               target="_blank"
               rel="noopener">
                Buka Form Lapor →
            </a>
        </div>
    `;

    return false;
}

/* =========================================================
   PAGE INIT
========================================================= */

async function initPage() {
    const body = document.body;
    const page = body.dataset.page;

    // Load form configs dari Supabase
    try {
        const { data, error } = await supabaseClient
            .from('form_configs')
            .select('slug, name, description, form_url, prefill, is_active, sort_order')
            .order('sort_order', { ascending: true });
        if (!error && data && data.length > 0) {
            formsConfig = {};
            data.forEach(r => {
                formsConfig[r.slug] = {
                    name:        r.name        || '',
                    description: r.description || '',
                    form_url:    r.form_url    || '',
                    prefill:     r.prefill     || {},
                    is_active:   r.is_active   !== false,
                    sort_order:  r.sort_order  || 0
                };
            });
        } else {
            formsConfig = {};
        }
    } catch (err) {
        console.error("Gagal load form configs", err);
        formsConfig = {};
    }

    if (page === "form") {
        const slug = body.dataset.formSlug || new URLSearchParams(location.search).get('slug') || '';
        if (slug) {
            body.dataset.formSlug = slug;
            // Set judul halaman dari formsConfig
            const title = (formsConfig && formsConfig[slug] && formsConfig[slug].name) || slug;
            const h1 = document.getElementById('form-title-main');
            const hdr = document.getElementById('pageHeaderTitle');
            if (h1)  h1.textContent  = title;
            if (hdr) hdr.textContent = title;
            document.title = title + ' | BSI Scholarship Inspirasi';
            initFormPage(slug);
        } else {
            location.replace('list-form.html');
        }
    }

    if (page === "list-form") {
        renderFormCards();
    }
}

/* =========================================================
   LIST FORM — dynamic card render
========================================================= */

const FORM_PAGE_MAP = {
    'pembinaan':          { page: 'form.html?slug=pembinaan',          desc: 'Presensi untuk kehadiran pembinaan rutin.' },
    'mentoring':          { page: 'form.html?slug=mentoring',          desc: 'Presensi untuk kehadiran mentoring.' },
    'tugas-pengganti':    { page: 'form.html?slug=tugas-pengganti',    desc: 'Tugas untuk memenuhi ketidakhadiranmu.' },
    'tp-alquran':         { page: 'form.html?slug=tp-alquran',         desc: 'Tugas untuk Kelas Al-Quran yang tidak dihadiri.' },
    'prepost':            { page: 'form.html?slug=prepost',            desc: 'Penilaian pemahaman materi sebelum dan setelah pembinaan.' },
    'self-assessment':    { page: 'form.html?slug=self-assessment',    desc: 'Penilaian diri kompetensi program.' },
    'lapor':              { page: 'lapor.html',                        desc: 'Laporkan dan perbarui nomor HP kamu.' },
    'feedback-pembinaan': { page: 'form.html?slug=feedback-pembinaan', desc: 'Beri masukan & saran untuk pembinaan.' },
};

const FORM_ICONS = {
    'pembinaan':          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'mentoring':          '<path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 7H5v10h14V9z"/>',
    'tugas-pengganti':    '<path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5"/>',
    'tp-alquran':         '<path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
    'prepost':            '<path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z"/>',
    'self-assessment':    '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
    'lapor':              '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'feedback-pembinaan': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    '_default':           '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
};

function renderFormCards() {
    const grid = document.getElementById('formsCardGrid');
    if (!grid) return;

    if (!formsConfig || Object.keys(formsConfig).length === 0) {
        grid.innerHTML = '<p style="color:#9ca3af;font-size:13px;grid-column:1/-1">Tidak ada form aktif saat ini.</p>';
        return;
    }

    const active = Object.entries(formsConfig)
        .filter(([, cfg]) => cfg.is_active !== false)
        .sort((a, b) => (a[1].sort_order || 0) - (b[1].sort_order || 0));

    if (!active.length) {
        grid.innerHTML = '<p style="color:#9ca3af;font-size:13px;grid-column:1/-1">Tidak ada form aktif saat ini.</p>';
        return;
    }

    grid.innerHTML = active.map(([slug, cfg]) => {
        const map  = FORM_PAGE_MAP[slug];
        const href = map ? map.page : '#';
        const desc = cfg.description || (map ? map.desc : '');
        const name = cfg.name || slug;
        const icon = FORM_ICONS[slug] || FORM_ICONS['_default'];
        return `<a href="${href}" class="card card--action">
            <div class="card-header">
                <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
                <h2 class="card-title">${name}</h2>
            </div>
            <p class="card-text">${desc}</p>
            <span class="card-button">Isi Form</span>
        </a>`;
    }).join('');
}

/* =========================================================
   NAV
========================================================= */

function toggleNav() {
    const nav = document.getElementById("mobileNav");
    if (nav) nav.classList.toggle("nav--open");
}

/* =========================================================
   EXPORT
========================================================= */

document.addEventListener("DOMContentLoaded", initPage);

window.handleFormSubmit = handleFormSubmit;
window.handleChangeNumber = handleChangeNumber;
window.toggleNav = toggleNav;


/* =========================================================
   AUTOCOMPLETE NIM / NAMA / KAMPUS (SUPABASE QUERY)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("nim");
    const box = document.getElementById("nim-suggestions");

    if (!input || !box) return;

    // pakai client yang SUDAH Anda buat
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase client tidak ditemukan");
        return;
    }

    let debounceTimer;
    const DEBOUNCE_DELAY = 300;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);

        const keyword = input.value.trim();
        if (keyword.length < 2) {
            box.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(keyword);
        }, DEBOUNCE_DELAY);
    });

    async function fetchSuggestions(keyword) {
        const { data, error } = await supabase
            .from("mahasiswa_bsi")
            .select("no_induk, nama, kampus")
            .or(
                `no_induk.ilike.%${keyword}%,nama.ilike.%${keyword}%,kampus.ilike.%${keyword}%`
            )
            .order("no_induk", { ascending: true })
            .limit(10);

        if (error) {
            console.error("Autocomplete error:", error);
            box.style.display = "none";
            return;
        }

        if (!data || data.length === 0) {
            box.style.display = "none";
            return;
        }

        box.innerHTML = data.map(m => `
            <div class="nim-suggestion-item" data-nim="${m.no_induk}">
                <strong>${m.no_induk}</strong>
                <span>${m.nama || "-"} — ${m.kampus || "-"}</span>
            </div>
        `).join("");

        box.style.display = "block";
    }

    box.addEventListener("click", e => {
        const item = e.target.closest(".nim-suggestion-item");
        if (!item) return;

        input.value = item.dataset.nim;
        box.style.display = "none";
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".nim-field-wrapper")) {
            box.style.display = "none";
        }
    });
});