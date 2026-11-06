/* =========================================
   VA ELECTRO MOBILE
   Munkakezelés + Pénzügyi modul
   + Dokumentumkezelés
========================================= */

const SUPABASE_URL = "https://fxxhxnpirxpjqadrwyzf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Zpk6zDDtgqFpkDc38ms6_g_gjzvn-ZS";

const DOCUMENT_BUCKET = "va-electro-documents";
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
];

const DOCUMENT_CATEGORIES = [
  "Szerződés",
  "Melléklet",
  "Teljesítésigazolás",
  "Mérési jegyzőkönyv",
  "Egyéb dokumentum"
];

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

const loginForm = $("loginForm");
const jobsPanel = $("jobList").closest(".panel");

let inquiries = [];
let payments = [];
let materialCosts = [];
let documents = [];

let documentsError = "";

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
    .job-toolbar { margin-top: 16px; }

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

    .job-tab-count { margin-left: 5px; opacity: .8; }

    .job-navigation {
      display: flex;
      gap: 10px;
      margin: 18px 0;
    }

    .job-navigation button { flex: 1; min-width: 0; }

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

    .admin-notes-area,
    .finance-input {
      width: 100%;
      min-height: 44px;
      padding: 12px;
      margin: 7px 0;
      box-sizing: border-box;
      background: #101010;
      color: #f4f1ed;
      border: 1px solid #74502f;
      border-radius: 11px;
      font: inherit;
    }

    .admin-notes-area {
      min-height: 130px;
      resize: vertical;
      line-height: 1.5;
    }

    .admin-notes-info,
    .finance-info {
      color: #aaa39c;
      font-size: 12px;
      margin: 5px 0 12px;
    }

    .admin-notes-save,
    .finance-save {
      width: 100%;
      margin-bottom: 12px;
    }

    .finance-section {
      margin-top: 25px;
      padding-top: 18px;
      border-top: 1px solid #51402f;
    }

    .finance-card {
      background: #151515;
      border: 1px solid #51402f;
      border-radius: 13px;
      padding: 13px;
      margin: 10px 0;
    }

    .finance-card span {
      display: block;
      color: #aaa39c;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .finance-card strong {
      color: #d49a64;
      font-size: 19px;
      overflow-wrap: anywhere;
    }

    .finance-list-item {
      background: #151515;
      border: 1px solid #37312c;
      border-radius: 12px;
      padding: 12px;
      margin: 9px 0;
    }

    .finance-list-item strong {
      color: #d49a64;
      display: block;
      margin-bottom: 5px;
    }

    .finance-list-item small {
      color: #aaa39c;
      display: block;
      line-height: 1.5;
    }

    .finance-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .finance-actions button {
      flex: 1;
      padding: 9px;
      border: 1px solid #705033;
      border-radius: 9px;
      background: transparent;
      color: #d49a64;
    }

    .finance-form {
      background: #191919;
      border: 1px solid #51402f;
      border-radius: 13px;
      padding: 13px;
      margin: 12px 0;
    }

    .finance-form h4 {
      margin: 0 0 10px;
      color: #d49a64;
    }

    .finance-cancel {
      width: 100%;
      margin-top: 7px;
    }

    .finance-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
      margin-top: 12px;
    }

    .finance-summary-grid .finance-card {
      margin: 0;
    }

    .finance-summary-grid .finance-card strong {
      font-size: 16px;
    }

    .danger-button {
      color: #e08a82 !important;
      border-color: #8a4540 !important;
    }

    .finance-empty {
      color: #aaa39c;
      font-size: 13px;
      padding: 8px 0;
    }

    .dashboard-finance {
      margin-top: 18px;
    }

    .dashboard-finance h2 {
      margin-bottom: 10px;
    }

    .job-button {
      display: block;
      width: 100%;
      text-align: left;
      color: #f4f1ed;
      font: inherit;
      background: transparent;
      border: 0;
      border-top: 1px solid #37312c;
      cursor: pointer;
    }

    .job-button:active { background: #252019; }

    .job-title { font-weight: 750; }

    .job-meta {
      color: #aaa39c;
      font-size: 12px;
      margin-top: 5px;
      line-height: 1.5;
    }

    .open-hint {
      color: #d49a64;
      font-size: 12px;
      margin-top: 10px;
    }

    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 11px 0;
      border-bottom: 1px solid #37312c;
    }

    .detail-row span {
      color: #aaa39c;
      font-size: 12px;
    }

    .detail-row strong {
      overflow-wrap: anywhere;
      font-size: 14px;
      font-weight: 600;
    }

    #detailContent h3 {
      color: #d49a64;
      font-size: 15px;
      margin: 25px 0 8px;
    }

    .contact-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 15px;
    }

    .contact-link {
      color: #d49a64;
      border: 1px solid #b87333;
      border-radius: 10px;
      padding: 10px 13px;
      text-decoration: none;
      font-size: 13px;
    }

    /* DOKUMENTUMKEZELÉS */

    .documents-section {
      margin-top: 25px;
      padding-top: 18px;
      border-top: 1px solid #51402f;
    }

    .document-form {
      background: #191919;
      border: 1px solid #51402f;
      border-radius: 13px;
      padding: 13px;
      margin: 12px 0;
    }

    .document-form h4 {
      margin: 0 0 12px;
      color: #d49a64;
    }

    .document-input {
      width: 100%;
      min-height: 44px;
      padding: 12px;
      margin: 7px 0 13px;
      box-sizing: border-box;
      background: #101010;
      color: #f4f1ed;
      border: 1px solid #74502f;
      border-radius: 11px;
      font: inherit;
    }

    .document-file-input {
      width: 100%;
      padding: 12px;
      margin: 7px 0 13px;
      box-sizing: border-box;
      background: #101010;
      color: #f4f1ed;
      border: 1px dashed #74502f;
      border-radius: 11px;
      font: inherit;
      font-size: 12px;
    }

    .document-info {
      color: #aaa39c;
      font-size: 12px;
      line-height: 1.6;
      margin: 5px 0 13px;
    }

    .document-upload-button {
      width: 100%;
    }

    .document-item {
      background: #151515;
      border: 1px solid #51402f;
      border-radius: 12px;
      padding: 13px;
      margin: 9px 0;
    }

    .document-item strong {
      display: block;
      color: #d49a64;
      overflow-wrap: anywhere;
      margin-bottom: 6px;
    }

    .document-item small {
      display: block;
      color: #aaa39c;
      font-size: 12px;
      line-height: 1.6;
    }

    .document-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .document-actions button {
      flex: 1;
      min-width: 0;
      padding: 10px 6px;
      border: 1px solid #705033;
      border-radius: 9px;
      background: transparent;
      color: #d49a64;
      font: inherit;
      font-size: 12px;
    }

    .document-empty {
      color: #aaa39c;
      font-size: 13px;
      padding: 12px 0;
    }

    .document-error {
      color: #e08a82;
      font-size: 13px;
      padding: 10px 0;
    }

    .document-loading {
      color: #aaa39c;
      font-size: 13px;
      padding: 10px 0;
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

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
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

        <div class="open-hint">Adatlap megnyitása →</div>
      </button>
    `).join("")
    : `
      <div class="job-empty">
        Ebben a fülben jelenleg nincs megjeleníthető munka.
      </div>
    `;
}

/* KATTINTÁSOK */

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
    $("dashboardFinance").classList.remove("hidden");
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

  $("detailContent").addEventListener("submit", handleFinanceSubmit);
  $("detailContent").addEventListener("submit", handleDocumentSubmit);

  $("detailContent").addEventListener("click", handleFinanceClick);
  $("detailContent").addEventListener("click", handleDocumentClick);
}

/* ELŐZŐ / KÖVETKEZŐ */

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

/* PÉNZÜGYI ADATOK */

function getJobPayments(jobId) {
  return payments
    .filter(item => item.inquiry_id === jobId)
    .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)));
}

function getJobMaterialCosts(jobId) {
  return materialCosts
    .filter(item => item.inquiry_id === jobId)
    .sort((a, b) => String(b.purchase_date).localeCompare(String(a.purchase_date)));
}

function getFinancialNumbers(job) {
  const jobPayments = getJobPayments(job.id);
  const jobCosts = getJobMaterialCosts(job.id);

  const received = jobPayments.reduce(
    (sum, item) => sum + numeric(item.amount), 0
  );

  const costs = jobCosts.reduce(
    (sum, item) => sum + numeric(item.amount), 0
  );

  const accepted = numeric(job.accepted_amount);
  const balance = Math.max(0, accepted - received);

  return {
    received,
    costs,
    accepted,
    balance,
    actualResult: received - costs,
    expectedResult: accepted - costs
  };
}

function financeCard(label, value) {
  return `
    <div class="finance-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatMoney(value)}</strong>
    </div>
  `;
}

function renderPaymentItems(jobId) {
  const items = getJobPayments(jobId);

  if (!items.length) {
    return `<div class="finance-empty">Még nincs rögzített részfizetés.</div>`;
  }

  return items.map(item => `
    <div class="finance-list-item">
      <strong>${formatMoney(item.amount)}</strong>
      <small>Dátum: ${escapeHtml(item.payment_date || "Nincs megadva")}</small>
      <small>${escapeHtml(item.note || "Nincs megjegyzés")}</small>

      <div class="finance-actions">
        <button type="button" data-finance-edit="payment"
          data-id="${escapeHtml(item.id)}">Szerkesztés</button>

        <button type="button" class="danger-button"
          data-finance-delete="payment"
          data-id="${escapeHtml(item.id)}">Törlés</button>
      </div>
    </div>
  `).join("");
}

function renderMaterialItems(jobId) {
  const items = getJobMaterialCosts(jobId);

  if (!items.length) {
    return `<div class="finance-empty">Még nincs rögzített anyagköltség.</div>`;
  }

  return items.map(item => `
    <div class="finance-list-item">
      <strong>${formatMoney(item.amount)}</strong>
      <small>Vásárlás dátuma: ${escapeHtml(item.purchase_date || "Nincs megadva")}</small>
      <small>${escapeHtml(item.note || "Nincs megjegyzés")}</small>

      <div class="finance-actions">
        <button type="button" data-finance-edit="material"
          data-id="${escapeHtml(item.id)}">Szerkesztés</button>

        <button type="button" class="danger-button"
          data-finance-delete="material"
          data-id="${escapeHtml(item.id)}">Törlés</button>
      </div>
    </div>
  `).join("");
}

function renderFinance(job) {
  const numbers = getFinancialNumbers(job);

  return `
    <div class="finance-section">
      <h3>Pénzügyi áttekintés</h3>

      <div class="finance-summary-grid">
        ${financeCard("Elfogadott összeg", numbers.accepted)}
        ${financeCard("Beérkezett összeg", numbers.received)}
        ${financeCard("Hátralék", numbers.balance)}
        ${financeCard("Anyagköltség", numbers.costs)}
      </div>

      <div class="finance-card">
        <span>Tényleges pénzügyi eredmény</span>
        <strong>${formatMoney(numbers.actualResult)}</strong>
        <div class="finance-info">
          Beérkezett pénz mínusz rögzített anyagköltségek.
        </div>
      </div>

      <div class="finance-card">
        <span>Várható eredmény az elfogadott összeg alapján</span>
        <strong>${formatMoney(numbers.expectedResult)}</strong>
      </div>

      <h3>Részfizetések</h3>

      <form id="paymentForm" class="finance-form">
        <h4 id="paymentFormTitle">Új részfizetés rögzítése</h4>

        <input type="hidden" name="edit_id">

        <label class="field">
          <span>Beérkezett összeg (Ft)</span>
          <input class="finance-input" name="amount"
            type="number" min="1" step="1" required>
        </label>

        <label class="field">
          <span>Fizetés dátuma</span>
          <input class="finance-input" name="date"
            type="date" value="${today()}" required>
        </label>

        <label class="field">
          <span>Megjegyzés</span>
          <input class="finance-input" name="note"
            type="text" placeholder="Pl. 1. részlet, előleg...">
        </label>

        <button class="primary finance-save" type="submit">
          Részfizetés mentése
        </button>

        <button class="secondary finance-cancel hidden"
          id="cancelPaymentEdit" type="button">
          Szerkesztés megszakítása
        </button>
      </form>

      <div id="paymentList">
        ${renderPaymentItems(job.id)}
      </div>

      <h3>Anyagköltségek</h3>

      <form id="materialForm" class="finance-form">
        <h4 id="materialFormTitle">Új anyagköltség rögzítése</h4>

        <input type="hidden" name="edit_id">

        <label class="field">
          <span>Anyagköltség (Ft)</span>
          <input class="finance-input" name="amount"
            type="number" min="1" step="1" required>
        </label>

        <label class="field">
          <span>Vásárlás dátuma</span>
          <input class="finance-input" name="date"
            type="date" value="${today()}" required>
        </label>

        <label class="field">
          <span>Megjegyzés</span>
          <input class="finance-input" name="note"
            type="text" placeholder="Pl. vezeték, szerelvény, elosztó...">
        </label>

        <button class="primary finance-save" type="submit">
          Anyagköltség mentése
        </button>

        <button class="secondary finance-cancel hidden"
          id="cancelMaterialEdit" type="button">
          Szerkesztés megszakítása
        </button>
      </form>

      <div id="materialList">
        ${renderMaterialItems(job.id)}
      </div>

      <div class="finance-info">
        A pénzügyi adatok kizárólag az adminisztrációban jelennek meg.
      </div>
    </div>
  `;
}

/* =========================================
   DOKUMENTUMKEZELÉS
========================================= */

/* Fájlnév biztonságos átalakítása */

function sanitizeFilename(filename) {
  const cleaned = String(filename || "dokumentum")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "")
    .slice(0, 120);

  return cleaned || "dokumentum";
}

/* Dokumentumok munkánként */

function getJobDocuments(jobId) {
  return documents
    .filter(item => item.inquiry_id === jobId)
    .sort((a, b) =>
      String(b.uploaded_at || "").localeCompare(String(a.uploaded_at || ""))
    );
}

function formatDocumentDate(value) {
  if (!value) return "Nincs megadva";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nincs megadva";
  }

  return date.toLocaleString("hu-HU");
}

/* Dokumentumlista megjelenítése */

function renderDocumentItems(jobId) {
  if (documentsError) {
    return `
      <div class="document-error">
        A dokumentumlista betöltése nem sikerült:
        ${escapeHtml(documentsError)}
      </div>
    `;
  }

  const items = getJobDocuments(jobId);

  if (!items.length) {
    return `
      <div class="document-empty">
        Ehhez a munkához még nincs feltöltött dokumentum.
      </div>
    `;
  }

  return items.map(item => `
    <div class="document-item">
      <strong>${escapeHtml(item.original_filename || "Dokumentum")}</strong>

      <small>
        Típus: ${escapeHtml(item.document_type || "Egyéb dokumentum")}
      </small>

      <small>
        Feltöltve: ${escapeHtml(formatDocumentDate(item.uploaded_at))}
      </small>

      <div class="document-actions">
        <button
          type="button"
          data-document-open="${escapeHtml(item.id)}"
        >
          Megnyitás
        </button>

        <button
          type="button"
          data-document-download="${escapeHtml(item.id)}"
        >
          Letöltés
        </button>
      </div>
    </div>
  `).join("");
}

/* Dokumentumkezelő felület */

function renderDocuments(job) {
  return `
    <div class="documents-section">
      <h3>Dokumentumok</h3>

      <form id="documentForm" class="document-form">
        <h4>Új dokumentum feltöltése</h4>

        <label class="field">
          <span>Dokumentum típusa</span>

          <select
            class="document-input"
            name="document_type"
            required
          >
            ${DOCUMENT_CATEGORIES.map(type => `
              <option value="${escapeHtml(type)}">
                ${escapeHtml(type)}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="field">
          <span>Fájl kiválasztása</span>

          <input
            class="document-file-input"
            type="file"
            name="document_file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            required
          >
        </label>

        <div class="document-info">
          Engedélyezett formátumok: PDF, JPG, PNG, WebP.
          <br>
          Maximális fájlméret: 15 MB.
          <br>
          A feltöltött dokumentumok nem törölhetők és nem írhatók felül.
        </div>

        <button
          class="primary document-upload-button"
          type="submit"
        >
          Dokumentum feltöltése
        </button>
      </form>

      <h3>Feltöltött dokumentumok</h3>

      <div id="documentList">
        ${renderDocumentItems(job.id)}
      </div>
    </div>
  `;
}

/* Dokumentumok betöltése adatbázisból */

async function loadDocuments() {
  const { data, error } = await supabaseClient
    .from("work_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  documents = data || [];
  documentsError = "";
}

/* Dokumentum feltöltése */

async function handleDocumentSubmit(event) {
  const form = event.target;

  if (!form.matches("#documentForm")) return;

  event.preventDefault();

  if (!currentJobId) return;

  const fileInput = form.elements.document_file;
  const file = fileInput.files?.[0];
  const documentType = form.elements.document_type.value;

  if (!file) {
    showMessage("Válassz ki egy dokumentumot.", true);
    return;
  }

  if (!DOCUMENT_CATEGORIES.includes(documentType)) {
    showMessage("Érvénytelen dokumentumtípus.", true);
    return;
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    showMessage(
      "Nem megfelelő fájlformátum. PDF, JPG, PNG vagy WebP tölthető fel.",
      true
    );
    return;
  }

  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    showMessage("A fájl mérete nem lehet 15 MB-nál nagyobb.", true);
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  const originalButtonText = button.textContent;

  button.disabled = true;
  button.textContent = "Feltöltés…";

  try {
    const safeName = sanitizeFilename(file.name);

    const uniqueId = typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const storagePath =
      `${currentJobId}/${uniqueId}-${safeName}`;

    /*
      1. Fájl feltöltése a privát tárhelyre.
      upsert:false: meglévő fájlt nem írhat felül.
    */

    const { error: uploadError } = await supabaseClient
      .storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    /*
      2. Dokumentum adatainak rögzítése.
    */

    const { data, error: insertError } = await supabaseClient
      .from("work_documents")
      .insert({
        inquiry_id: currentJobId,
        storage_path: storagePath,
        original_filename: file.name,
        document_type: documentType
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(
        "A fájl feltöltése megtörtént, de az adatbázisba mentés nem sikerült: " +
        insertError.message
      );
    }

    documents.unshift(data);

    const job = inquiries.find(item => item.id === currentJobId);

    if (job) {
      openJob(currentJobId);
    }

    showMessage("A dokumentum sikeresen feltöltve.");

  } catch (error) {
    console.error("Dokumentumfeltöltési hiba:", error);

    showMessage(
      "Dokumentumfeltöltési hiba: " + error.message,
      true
    );

    button.disabled = false;
    button.textContent = originalButtonText;
  }
}

/* Dokumentum megnyitása és letöltése */

async function handleDocumentClick(event) {
  const openButton = event.target.closest("[data-document-open]");

  if (openButton) {
    await openDocument(openButton.dataset.documentOpen);
    return;
  }

  const downloadButton = event.target.closest("[data-document-download]");

  if (downloadButton) {
    await downloadDocument(downloadButton.dataset.documentDownload);
  }
}

/* Privát dokumentum megnyitása */

async function openDocument(id) {
  const item = documents.find(doc => String(doc.id) === String(id));

  if (!item) {
    showMessage("A dokumentum nem található.", true);
    return;
  }

  // Az üres lapot még a gombnyomás közvetlen hatására megnyitjuk,
  // így kisebb eséllyel blokkolja a böngésző.
  const newWindow = window.open("about:blank", "_blank");

  if (!newWindow) {
    showMessage(
      "A böngésző blokkolta a megnyitást. Engedélyezd a felugróablakokat.",
      true
    );
    return;
  }

  try {
    showMessage("Dokumentum megnyitása…");

    const { data, error } = await supabaseClient
      .storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(item.storage_path, 60);

    if (error) throw error;

    if (!data?.signedUrl) {
      throw new Error("Nem sikerült létrehozni a dokumentum elérési linkjét.");
    }

    newWindow.location.href = data.signedUrl;

    showMessage("A dokumentum megnyitása elindult.");

  } catch (error) {
    newWindow.close();

    showMessage(
      "Dokumentummegnyitási hiba: " + error.message,
      true
    );
  }
}

/* Dokumentum letöltése */

async function downloadDocument(id) {
  const item = documents.find(doc => String(doc.id) === String(id));

  if (!item) {
    showMessage("A dokumentum nem található.", true);
    return;
  }

  try {
    showMessage("Dokumentum letöltése…");

    const { data, error } = await supabaseClient
      .storage
      .from(DOCUMENT_BUCKET)
      .download(item.storage_path);

    if (error) throw error;

    const objectUrl = URL.createObjectURL(data);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = item.original_filename || "dokumentum";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);

    showMessage("A dokumentum letöltése elindult.");

  } catch (error) {
    showMessage(
      "Dokumentumletöltési hiba: " + error.message,
      true
    );
  }
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

    <span class="status">${escapeHtml(statusLabel(job.status))}</span>

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

    <h3>Ajánlati adatok</h3>

    ${detailRow("Becsült összeg", formatMoney(job.estimated_price))}
    ${detailRow("Ajánlati összeg", formatMoney(job.offer_amount))}
    ${detailRow("Elfogadott összeg", formatMoney(job.accepted_amount))}

    ${renderFinance(job)}

    ${renderDocuments(job)}

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
  $("dashboardFinance").classList.add("hidden");
  jobsPanel.classList.add("hidden");
  $("detailView").classList.remove("hidden");

  updateJobNavigation();
  showMessage("Munka adatlap megnyitva.");
}

/* PÉNZÜGYI ŰRLAPOK */

async function handleFinanceSubmit(event) {
  const form = event.target;

  if (!form.matches("#paymentForm, #materialForm")) return;

  event.preventDefault();

  if (!currentJobId) return;

  const isPayment = form.id === "paymentForm";
  const table = isPayment ? "work_payments" : "work_material_costs";

  const amount = Number(form.elements.amount.value);
  const date = form.elements.date.value;
  const note = form.elements.note.value.trim();
  const editId = form.elements.edit_id.value;

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("Adj meg érvényes, nullánál nagyobb összeget.", true);
    return;
  }

  if (!date) {
    showMessage("A dátum megadása kötelező.", true);
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Mentés…";

  const values = isPayment
    ? {
        inquiry_id: currentJobId,
        amount,
        payment_date: date,
        note
      }
    : {
        inquiry_id: currentJobId,
        amount,
        purchase_date: date,
        note
      };

  try {
    let response;

    if (editId) {
      response = await supabaseClient
        .from(table)
        .update(values)
        .eq("id", editId)
        .eq("inquiry_id", currentJobId);
    } else {
      response = await supabaseClient
        .from(table)
        .insert(values);
    }

    if (response.error) throw response.error;

    await loadFinancialRecords();

    const job = inquiries.find(item => item.id === currentJobId);
    if (job) openJob(currentJobId);

    showMessage(
      isPayment
        ? "A részfizetés sikeresen mentve."
        : "Az anyagköltség sikeresen mentve."
    );

  } catch (error) {
    showMessage("Pénzügyi mentési hiba: " + error.message, true);
    button.disabled = false;
    button.textContent = isPayment
      ? "Részfizetés mentése"
      : "Anyagköltség mentése";
  }
}

/* SZERKESZTÉS ÉS TÖRLÉS */

function handleFinanceClick(event) {
  const editButton = event.target.closest("[data-finance-edit]");

  if (editButton) {
    editFinanceItem(
      editButton.dataset.financeEdit,
      editButton.dataset.id
    );
    return;
  }

  const deleteButton = event.target.closest("[data-finance-delete]");

  if (deleteButton) {
    deleteFinanceItem(
      deleteButton.dataset.financeDelete,
      deleteButton.dataset.id
    );
    return;
  }

  if (event.target.id === "cancelPaymentEdit") {
    resetFinanceForm("paymentForm");
  }

  if (event.target.id === "cancelMaterialEdit") {
    resetFinanceForm("materialForm");
  }
}

function editFinanceItem(type, id) {
  const isPayment = type === "payment";

  const item = isPayment
    ? payments.find(x => String(x.id) === String(id))
    : materialCosts.find(x => String(x.id) === String(id));

  if (!item) return;

  const form = $(isPayment ? "paymentForm" : "materialForm");

  form.elements.edit_id.value = item.id;
  form.elements.amount.value = item.amount;

  form.elements.date.value = isPayment
    ? item.payment_date || today()
    : item.purchase_date || today();

  form.elements.note.value = item.note || "";

  $(isPayment ? "paymentFormTitle" : "materialFormTitle").textContent =
    isPayment ? "Részfizetés szerkesztése" : "Anyagköltség szerkesztése";

  form.querySelector('button[type="submit"]').textContent = "Módosítás mentése";

  $(isPayment ? "cancelPaymentEdit" : "cancelMaterialEdit")
    .classList.remove("hidden");

  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetFinanceForm(formId) {
  const form = $(formId);
  if (!form) return;

  form.reset();
  form.elements.edit_id.value = "";
  form.elements.date.value = today();

  const isPayment = formId === "paymentForm";

  $(isPayment ? "paymentFormTitle" : "materialFormTitle").textContent =
    isPayment ? "Új részfizetés rögzítése" : "Új anyagköltség rögzítése";

  form.querySelector('button[type="submit"]').textContent =
    isPayment ? "Részfizetés mentése" : "Anyagköltség mentése";

  $(isPayment ? "cancelPaymentEdit" : "cancelMaterialEdit")
    .classList.add("hidden");
}

async function deleteFinanceItem(type, id) {
  const isPayment = type === "payment";
  const table = isPayment ? "work_payments" : "work_material_costs";

  const confirmed = confirm(
    isPayment
      ? "Biztosan törlöd ezt a részfizetést?"
      : "Biztosan törlöd ezt az anyagköltséget?"
  );

  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from(table)
      .delete()
      .eq("id", id)
      .eq("inquiry_id", currentJobId);

    if (error) throw error;

    await loadFinancialRecords();
    openJob(currentJobId);

    showMessage(
      isPayment
        ? "A részfizetés törölve."
        : "Az anyagköltség törölve."
    );

  } catch (error) {
    showMessage("Törlési hiba: " + error.message, true);
  }
}

/* PÉNZÜGYI ADATOK BETÖLTÉSE */

async function loadFinancialRecords() {
  const [paymentResult, materialResult] = await Promise.all([
    supabaseClient
      .from("work_payments")
      .select("*"),

    supabaseClient
      .from("work_material_costs")
      .select("*")
  ]);

  if (paymentResult.error) throw paymentResult.error;
  if (materialResult.error) throw materialResult.error;

  payments = paymentResult.data || [];
  materialCosts = materialResult.data || [];
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
      .update({ admin_notes: notes })
      .eq("id", currentJobId);

    if (error) throw error;

    const job = inquiries.find(item => item.id === currentJobId);

    if (job) job.admin_notes = notes;

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

    if (job) job.status = newStatus;

    if (currentFilter !== "all") {
      currentFilter = newStatus;
    }

    updateCounters();
    renderJobs();
    renderDashboardFinance();
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

function createDashboardFinance() {
  if ($("dashboardFinance")) return;

  const section = document.createElement("section");
  section.id = "dashboardFinance";
  section.className = "panel dashboard-finance";

  section.innerHTML = `
    <h2>Pénzügyi áttekintés</h2>
    <div id="dashboardFinanceContent">
      <p class="notice">Pénzügyi adatok betöltése…</p>
    </div>
  `;

  $("dashboardView").insertBefore(section, $("appMessage"));
}

function renderDashboardFinance() {
  const container = $("dashboardFinanceContent");
  if (!container) return;

  const sentOffers = inquiries
    .filter(job => job.status === "offer_sent")
    .reduce((sum, job) => sum + numeric(job.offer_amount), 0);

  const totalReceived = payments.reduce(
    (sum, item) => sum + numeric(item.amount), 0
  );

  const totalBalance = inquiries
    .filter(job => job.status === "accepted")
    .reduce((sum, job) => {
      const numbers = getFinancialNumbers(job);
      return sum + numbers.balance;
    }, 0);

  container.innerHTML = `
    <div class="finance-summary-grid">
      ${financeCard("Kiküldött ajánlatok összege", sentOffers)}
      ${financeCard("Összes beérkezett kifizetés", totalReceived)}
      ${financeCard("Fennmaradó hátralék", totalBalance)}
    </div>
  `;
}

/* ADATOK BETÖLTÉSE */

async function loadDashboard() {
  showDashboard();

  createDetailView();
  createJobControls();
  createDashboardFinance();
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

  await loadFinancialRecords();

  /*
    A dokumentumok betöltési hibája nem állítja le
    a munkalista és a pénzügyi modul működését.
  */

  try {
    await loadDocuments();
  } catch (documentError) {
    console.error("Dokumentumok betöltési hibája:", documentError);
    documents = [];
    documentsError = documentError.message;
  }

  updateCounters();
  renderJobs();
  renderDashboardFinance();

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
