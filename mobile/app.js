
/* =========================================
   VA ELECTRO MOBILE
   Munkakezelés – teljes verzió
   Fülek, keresés, navigáció,
   státuszkezelés, admin megjegyzések
========================================= */

const SUPABASE_URL = "https://fxxhxnpirxpjqadrwyzf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Zpk6zDDtgqFpkDc38ms6_g_gjzvn-ZS";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);
const loginForm = $("loginForm");
const jobsPanel = $("jobList").closest(".panel");

let inquiries = [];
let currentJobId = null;
let currentFilter = "all";
let searchTerm = "";

const statuses = {
  new: "Új megkeresés",
  contacted: "Kapcsolatfelvétel",
  offer_sent: "Ajánlat elküldve",
  accepted: "Elfogadva – aktív munka",
  completed: "Elkészült",
  rejected: "Elutasítva",
  closed: "Lezárva"
};

const filters = [
  { id: "all", label: "Összes munka" },
  ...Object.entries(statuses).map(([id, label]) => ({
    id,
    label
  }))
];

/* MEGJELENÉS */

function addAppStyles() {
  if ($("vaMobileExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "vaMobileExtraStyles";

  style.textContent = `
    .job-toolbar {
      margin-top: 16px;
    }

    .job-search {
      width: 100%;
      padding: 13px;
      background: #101010;
      color: #f4f1ed;
      border: 1px solid #51402f;
      border-radius: 11px;
      margin-bottom: 13px;
      font: inherit;
    }

    .job-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 3px 0 12px;
      scrollbar-width: thin;
    }

    .job-tab {
      flex: 0 0 auto;
      padding: 9px 12px;
      border: 1px solid #51402f;
      border-radius: 10px;
      background: #151515;
      color: #c9c0b7;
      font-size: 12px;
      white-space: nowrap;
    }

    .job-tab.active {
      background: #b87333;
      border-color: #b87333;
      color: #160f09;
      font-weight: 800;
    }

    .job-tab-count {
      margin-left: 5px;
      opacity: .8;
    }

    .job-navigation {
      display: flex;
      gap: 10px;
      margin: 18px 0;
    }

    .job-navigation button {
      flex: 1;
      min-width: 0;
    }

    .job-navigation button:disabled {
      opacity: .35;
      cursor: not-allowed;
    }

    .job-position {
      text-align: center;
      color: #aaa39c;
      font-size: 12px;
      margin: 8px 0;
    }

    .job-empty {
      padding: 18px 0;
      color: #aaa39c;
      font-size: 13px;
    }

    .admin-notes-area {
      width: 100%;
      min-height: 130px;
      padding: 13px;
      margin: 10px 0;
      box-sizing: border-box;
      resize: vertical;
      background: #101010;
      color: #f4f1ed;
      border: 1px solid #74502f;
      border-radius: 11px;
      font: inherit;
      line-height: 1.5;
    }

    .admin-notes-info {
      color: #aaa39c;
      font-size: 12px;
      margin: 5px 0 12px;
    }

    .admin-notes-save {
      width: 100%;
      margin-bottom: 12px;
    }
  `;

  document.head.appendChild(style);
}

/* SEGÉDFÜGGVÉNYEK */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") {
    return "Nincs megadva";
  }

  return Number(value).toLocaleString("hu-HU") + " Ft";
}

function showMessage(message = "", isError = false) {
  $("appMessage").textContent = message;
  $("appMessage").className = isError ? "error" : "notice";
}

function showLogin(message = "") {
  $("loginView").classList.remove("hidden");
  $("dashboardView").classList.add("hidden");
  $("loginError").textContent = message;
}

function showDashboard() {
  $("loginView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");
}

function statusLabel(status) {
  return statuses[status] || status || "Nincs megadva";
}

/* ADMIN ELLENŐRZÉS */

async function checkAdmin() {
  const { data, error } = await supabaseClient.rpc(
    "is_va_electro_admin"
  );

  if (error) throw error;

  if (data !== true) {
    throw new Error("Ehhez a fiókhoz nincs admin jogosultság.");
  }
}

/* MUNKAFÜLEK ÉS KERESŐ */

function createJobControls() {
  if ($("jobToolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "jobToolbar";
  toolbar.className = "job-toolbar";

  toolbar.innerHTML = `
    <input
      id="jobSearch"
      class="job-search"
      type="search"
      placeholder="Keresés név, település vagy munkaszám alapján..."
    >
    <div id="jobTabs" class="job-tabs"></div>
  `;

  $("jobList").before(toolbar);

  $("jobSearch").addEventListener("input", event => {
    searchTerm = event.target.value.trim().toLocaleLowerCase("hu");
    renderJobs();
  });
}

function getVisibleJobs() {
  return inquiries.filter(job => {
    const matchesFilter =
      currentFilter === "all" || job.status === currentFilter;

    const searchable = [
      job.customer_name,
      job.city,
      job.work_number,
      job.service_type,
      job.customer_phone
    ].join(" ").toLocaleLowerCase("hu");

    const matchesSearch =
      !searchTerm || searchable.includes(searchTerm);

    return matchesFilter && matchesSearch;
  });
}

function renderTabs() {
  $("jobTabs").innerHTML = filters.map(filter => {
    const count = filter.id === "all"
      ? inquiries.length
      : inquiries.filter(job => job.status === filter.id).length;

    return `
      <button
        type="button"
        class="job-tab ${currentFilter === filter.id ? "active" : ""}"
        data-filter="${filter.id}"
      >
        ${escapeHtml(filter.label)}
        <span class="job-tab-count">${count}</span>
      </button>
    `;
  }).join("");
}

function renderJobs() {
  renderTabs();

  const jobs = getVisibleJobs();

  $("jobList").innerHTML = jobs.length
    ? jobs.map(item => `
      <button
        class="job job-button"
        type="button"
        data-job-id="${escapeHtml(item.id)}"
      >
        <div class="job-title">
          ${escapeHtml(item.customer_name)}
        </div>

        <div class="job-meta">
          ${escapeHtml(item.work_number || "Még nincs munkaszám")}
          · ${escapeHtml(item.city || "Nincs település")}
          <br>
          ${escapeHtml(item.service_type)}
        </div>

        <span class="status">
          ${escapeHtml(statusLabel(item.status))}
        </span>

        <div class="open-hint">
          Adatlap megnyitása →
        </div>
      </button>
    `).join("")
    : `
      <div class="job-empty">
        Ebben a fülben jelenleg nincs megjeleníthető munka.
      </div>
    `;
}

/* KATTINTÁSOK KEZELÉSE */

jobsPanel.addEventListener("click", event => {
  const tab = event.target.closest("[data-filter]");

  if (tab) {
    currentFilter = tab.dataset.filter;
    renderJobs();
    return;
  }

  const jobButton = event.target.closest("[data-job-id]");

  if (jobButton) {
    openJob(jobButton.dataset.jobId);
  }
});

/* MUNKALAP */

function createDetailView() {
  if ($("detailView")) return;

  const detail = document.createElement("section");
  detail.id = "detailView";
  detail.className = "panel hidden";

  detail.innerHTML = `
    <button id="backToJobs" class="secondary">
      ← Vissza a munkákhoz
    </button>

    <div class="job-navigation">
      <button id="previousJob" class="secondary" type="button">
        ← Előző
      </button>

      <button id="nextJob" class="secondary" type="button">
        Következő →
      </button>
    </div>

    <div id="jobPosition" class="job-position"></div>

    <div id="detailContent"></div>
  `;

  $("dashboardView").appendChild(detail);

  $("backToJobs").addEventListener("click", () => {
    detail.classList.add("hidden");
    document.querySelector(".grid").classList.remove("hidden");
    jobsPanel.classList.remove("hidden");

    currentJobId = null;
    showMessage("Munkalista");
  });

  $("previousJob").addEventListener("click", () => {
    moveBetweenJobs(-1);
  });

  $("nextJob").addEventListener("click", () => {
    moveBetweenJobs(1);
  });
}

function detailRow(label, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

/* ELŐZŐ / KÖVETKEZŐ MUNKA */

function updateJobNavigation() {
  const jobs = getVisibleJobs();
  const index = jobs.findIndex(job => job.id === currentJobId);

  $("previousJob").disabled = index <= 0;
  $("nextJob").disabled = index < 0 || index >= jobs.length - 1;

  $("jobPosition").textContent = index >= 0
    ? `${index + 1} / ${jobs.length} munka`
    : "A munka nem szerepel a jelenlegi szűrésben.";
}

function moveBetweenJobs(direction) {
  const jobs = getVisibleJobs();
  const index = jobs.findIndex(job => job.id === currentJobId);

  if (index < 0) return;

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= jobs.length) return;

  openJob(jobs[nextIndex].id);
}

/* MUNKA MEGNYITÁSA */

function openJob(id) {
  const job = inquiries.find(item => item.id === id);
  if (!job) return;

  currentJobId = id;

  createDetailView();

  const phone = String(job.customer_phone || "");
  const safePhone = phone.replace(/[^\d+]/g, "");
  const email = String(job.customer_email || "");

  const phoneLink = safePhone
    ? `<a class="contact-link" href="tel:${escapeHtml(safePhone)}">Telefonhívás</a>`
    : "";

  const emailLink = email
    ? `<a class="contact-link" href="mailto:${encodeURIComponent(email)}">E-mail küldése</a>`
    : "";

  const statusOptions = Object.entries(statuses).map(([value, label]) => `
    <option value="${value}" ${job.status === value ? "selected" : ""}>
      ${escapeHtml(label)}
    </option>
  `).join("");

  $("detailContent").innerHTML = `
    <h2>${escapeHtml(job.customer_name)}</h2>

    <span class="status">
      ${escapeHtml(statusLabel(job.status))}
    </span>

    <h3>Ügyfél adatai</h3>

    ${detailRow("Telefonszám", job.customer_phone)}
    ${detailRow("E-mail", job.customer_email)}
    ${detailRow("Település", job.city)}

    <div class="contact-actions">
      ${phoneLink}
      ${emailLink}
    </div>

    <h3>Munka adatai</h3>

    ${detailRow("Munkaszám", job.work_number)}
    ${detailRow("Szolgáltatás", job.service_type)}
    ${detailRow("Kért időpont", job.preferred_date)}
    ${detailRow("Állapot", statusLabel(job.status))}

    <h3>Munka állapotának módosítása</h3>

    <label class="field">
      <span>Új állapot</span>
      <select id="newStatus">
        ${statusOptions}
      </select>
    </label>

    <button id="saveStatusButton" class="primary" type="button">
      Állapot mentése
    </button>

    <h3>Pénzügyi adatok</h3>

    ${detailRow("Becsült összeg", formatMoney(job.estimated_price))}
    ${detailRow("Ajánlati összeg", formatMoney(job.offer_amount))}
    ${detailRow("Elfogadott összeg", formatMoney(job.accepted_amount))}

    <h3>Munka részletei</h3>

    ${detailRow("Leírás", job.description)}
    ${detailRow("Hibakeresési összefoglaló", job.troubleshooting_summary)}

    <h3>Adminisztráció</h3>

    <label class="field" for="adminNotesInput">
      <span>Belső adminisztrációs megjegyzés</span>
    </label>

    <textarea
      id="adminNotesInput"
      class="admin-notes-area"
      placeholder="Ide írhatod a munkával kapcsolatos belső megjegyzéseidet..."
    >${escapeHtml(job.admin_notes || "")}</textarea>

    <div class="admin-notes-info">
      Ez a megjegyzés csak az adminisztrációban jelenik meg.
    </div>

    <button
      id="saveAdminNotesButton"
      class="primary admin-notes-save"
      type="button"
    >
      Megjegyzés mentése
    </button>

    ${detailRow("Ajánlat elküldve", job.offer_sent_at)}
    ${detailRow(
      "Létrehozva",
      job.created_at
        ? new Date(job.created_at).toLocaleString("hu-HU")
        : ""
    )}
  `;

  $("saveStatusButton").addEventListener("click", saveJobStatus);
  $("saveAdminNotesButton").addEventListener("click", saveAdminNotes);

  document.querySelector(".grid").classList.add("hidden");
  jobsPanel.classList.add("hidden");
  $("detailView").classList.remove("hidden");

  updateJobNavigation();
  showMessage("Munka adatlap megnyitva.");
}

/* ADMIN MEGJEGYZÉS MENTÉSE */

async function saveAdminNotes() {
  if (!currentJobId) return;

  const button = $("saveAdminNotesButton");
  const textarea = $("adminNotesInput");
  const notes = textarea.value.trim();

  button.disabled = true;
  button.textContent = "Mentés…";

  try {
    const { error } = await supabaseClient
      .from("inquiries")
      .update({
        admin_notes: notes
      })
      .eq("id", currentJobId);

    if (error) throw error;

    const job = inquiries.find(item => item.id === currentJobId);

    if (job) {
      job.admin_notes = notes;
    }

    button.disabled = false;
    button.textContent = "Megjegyzés mentése";

    showMessage("Az adminisztrációs megjegyzés sikeresen mentve.");

  } catch (error) {
    button.disabled = false;
    button.textContent = "Megjegyzés mentése";

    showMessage("Megjegyzés mentési hiba: " + error.message, true);
  }
}

/* STÁTUSZ MENTÉSE */

async function saveJobStatus() {
  const newStatus = $("newStatus").value;
  const button = $("saveStatusButton");

  if (!currentJobId) return;

  button.disabled = true;
  button.textContent = "Mentés…";

  try {
    const { error } = await supabaseClient
      .from("inquiries")
      .update({ status: newStatus })
      .eq("id", currentJobId);

    if (error) throw error;

    const job = inquiries.find(item => item.id === currentJobId);

    if (job) {
      job.status = newStatus;
    }

    if (currentFilter !== "all") {
      currentFilter = newStatus;
    }

    updateCounters();
    renderJobs();
    openJob(currentJobId);

    showMessage("A munka állapota sikeresen módosult.");

  } catch (error) {
    showMessage("Mentési hiba: " + error.message, true);

    button.disabled = false;
    button.textContent = "Állapot mentése";
  }
}

/* VEZÉRLŐPULT */

function updateCounters() {
  $("newCount").textContent =
    inquiries.filter(x => x.status === "new").length;

  $("activeCount").textContent =
    inquiries.filter(x => x.status === "accepted").length;

  $("completedCount").textContent =
    inquiries.filter(x => x.status === "completed").length;
}

async function loadDashboard() {
  showDashboard();

  createDetailView();
  createJobControls();
  addAppStyles();

  if (!navigator.onLine) {
    showMessage("Offline állapot – az online adatok nem érhetők el.");
    return;
  }

  showMessage("Adatok betöltése…");

  const { data, error } = await supabaseClient
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  inquiries = data || [];

  updateCounters();
  renderJobs();

  showMessage("Kapcsolódva a VA ELECTRO adatbázishoz.");
}

/* BEJELENTKEZÉS */

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  $("loginButton").disabled = true;
  $("loginButton").textContent = "Belépés…";
  $("loginError").textContent = "";

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    await checkAdmin();
    await loadDashboard();

  } catch (error) {
    await supabaseClient.auth.signOut();
    showLogin(error.message || "Nem sikerült belépni.");

  } finally {
    $("loginButton").disabled = false;
    $("loginButton").textContent = "Biztonságos belépés";
  }
});

/* KIJELENTKEZÉS */

$("logoutButton").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin("Sikeres kijelentkezés.");
});

/* INTERNETKAPCSOLAT */

window.addEventListener("online", () => {
  if (!$("dashboardView").classList.contains("hidden")) {
    loadDashboard().catch(error => {
      showMessage(error.message, true);
    });
  }
});

/* INDÍTÁS */

async function startApp() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }

  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      showLogin();
      return;
    }

    await checkAdmin();
    await loadDashboard();

  } catch (error) {
    await supabaseClient.auth.signOut();
    showLogin(error.message || "A munkamenet ellenőrzése nem sikerült.");
  }
}

startApp();
