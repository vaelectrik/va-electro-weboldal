/* =========================================
   VA ELECTRO MOBILE
   Munkakezelés + Pénzügyi modul
   + Dokumentumkezelés
   + Titkosított offline pénzügyi mentés
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

let pendingOfflineChanges = [];
let offlineSyncRunning = false;
let offlineCryptoKey = null;
let offlinePinSetupMode = false;

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
  $("pinView").classList.add("hidden");
  $("dashboardView").classList.add("hidden");

  $("loginError").textContent = message;
}

function showPinLogin(message = "", setupMode = false) {
  offlinePinSetupMode = setupMode;

  $("loginView").classList.add("hidden");
  $("pinView").classList.remove("hidden");
  $("dashboardView").classList.add("hidden");

  $("pinError").textContent = message;
  $("offlinePin").value = "";

  $("pinConfirmField").classList.toggle("hidden", !setupMode);
  $("offlinePinConfirm").value = "";

  const button = $("pinForm").querySelector('button[type="submit"]');

  button.textContent = setupMode
    ? "PIN-kód beállítása"
    : "Offline belépés";
}

function showDashboard() {
  $("loginView").classList.add("hidden");
  $("pinView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");
}
/* =========================================
   VA ELECTRO MOBILE – ÚJ NAVIGÁCIÓ
========================================= */

let currentPage = "home";
let navigationInitialized = false;
let notificationItems = [];
let notificationChannel = null;
let calendarEvents = [];

let calendarCurrentDate = new Date();
let calendarSelectedDate = today();
let calendarViewMode = "month";
let calendarInitialized = false;
function formatCalendarDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function renderCalendar() {
  const grid = $("calendarGrid");
  const title = $("calendarCurrentTitle");

  if (!grid || !title) return;

  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();

  title.textContent = calendarCurrentDate.toLocaleDateString(
    "hu-HU",
    { year: "numeric", month: "long" }
  );

  let startDate;
  let endDate;

  if (calendarViewMode === "month") {
    startDate = new Date(year, month, 1);
    const weekday = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - weekday);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41);
  } else {
    startDate = new Date(calendarSelectedDate + "T12:00:00");
    const weekday = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - weekday);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  }

  const days = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  grid.innerHTML = days.map(date => {
    const dateKey = formatCalendarDate(date);

    const events = calendarEvents.filter(
      event => event.event_date === dateKey
    );

    const outsideMonth = date.getMonth() !== month;

    return `
      <button
        type="button"
        class="calendar-day
          ${outsideMonth && calendarViewMode === "month" ? "outside-month" : ""}
          ${dateKey === calendarSelectedDate ? "selected" : ""}
          ${dateKey === today() ? "today" : ""}"
        data-calendar-date="${dateKey}"
      >
        <span>${date.getDate()}</span>
        ${events.length
          ? `<small>${events.length} esemény</small>`
          : ""}
      </button>
    `;
  }).join("");

  $("calendarSelectedDate").textContent =
    new Date(calendarSelectedDate + "T12:00:00")
      .toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

  renderCalendarDayEvents();
}
function renderCalendarDayEvents() {
  const container = $("calendarDayEvents");

  if (!container) return;

  const events = calendarEvents
    .filter(event => event.event_date === calendarSelectedDate)
    .sort((a, b) => {
      return (a.event_time || "").localeCompare(b.event_time || "");
    });

  if (!events.length) {
    container.innerHTML = `
      <p class="notice">
        Erre a napra még nincs esemény.
      </p>
    `;
    return;
  }

  container.innerHTML = events.map(event => {
    const typeLabels = {
      planned_work: "Tervezett munka",
      reminder: "Emlékeztető",
      personal: "Saját esemény"
    };

    return `
      <div class="calendar-event-card ${event.is_completed ? "completed" : ""}">
        <div class="calendar-event-info">
          <strong>${escapeHtml(event.title)}</strong>

          <span class="calendar-event-type">
            ${typeLabels[event.event_type] || "Esemény"}
          </span>

          ${event.event_time
            ? `<span>🕒 ${event.event_time.slice(0, 5)}</span>`
            : ""}

          ${event.description
            ? `<p>${escapeHtml(event.description)}</p>`
            : ""}

          ${event.is_completed
            ? `<span>✓ Elvégezve</span>`
            : ""}
        </div>

        <div class="calendar-event-actions">
          <button
            type="button"
            data-calendar-action="edit"
            data-event-id="${event.id}"
          >
            Szerkesztés
          </button>

          <button
            type="button"
            data-calendar-action="complete"
            data-event-id="${event.id}"
          >
            ${event.is_completed ? "Visszaállítás" : "Elvégezve"}
          </button>

          <button
            type="button"
            data-calendar-action="delete"
            data-event-id="${event.id}"
          >
            Törlés
          </button>
        </div>
      </div>
    `;
  }).join("");
}
function openCalendarEventForm(event = null) {
  const panel = $("calendarEventFormPanel");
  const form = $("calendarEventForm");

  if (!panel || !form) return;

  form.reset();

  $("calendarEventId").value = event?.id || "";
  $("calendarEventName").value = event?.title || "";
  $("calendarEventType").value = event?.event_type || "reminder";
  $("calendarEventDate").value =
    event?.event_date || calendarSelectedDate;

  $("calendarEventTime").value =
    event?.event_time?.slice(0, 5) || "";

  $("calendarEventEndTime").value =
    event?.end_time?.slice(0, 5) || "";

  $("calendarEventDescription").value =
    event?.description || "";

  $("calendarEventJob").value =
    event?.inquiry_id || "";

  $("calendarReminderAt").value =
    event?.reminder_at
      ? new Date(event.reminder_at).toISOString().slice(0, 16)
      : "";

  $("calendarFormTitle").textContent =
    event ? "Esemény szerkesztése" : "Új esemény";

  panel.classList.remove("hidden");

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeCalendarEventForm() {
  const panel = $("calendarEventFormPanel");
  const form = $("calendarEventForm");

  if (form) form.reset();

  if ($("calendarEventId")) {
    $("calendarEventId").value = "";
  }

  if (panel) {
    panel.classList.add("hidden");
  }
}
async function loadCalendarEvents() {
  if (!navigator.onLine) {
    renderCalendar();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (error) throw error;

    calendarEvents = data || [];

    renderCalendar();

  } catch (error) {
    console.error("Naptár betöltési hiba:", error);

    showMessage(
      "A naptáresemények betöltése nem sikerült.",
      true
    );
  }
}
async function toggleCalendarEventCompleted(eventId) {
  const calendarEvent = calendarEvents.find(
    item => item.id === eventId
  );

  if (!calendarEvent) return;

  if (!navigator.onLine) {
    showMessage("Ehhez a művelethez internetkapcsolat szükséges.", true);
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("calendar_events")
      .update({
        is_completed: !calendarEvent.is_completed,
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId);

    if (error) throw error;

    await loadCalendarEvents();

    showMessage(
      calendarEvent.is_completed
        ? "Esemény visszaállítva."
        : "Esemény elvégzettként megjelölve."
    );

  } catch (error) {
    console.error("Naptáresemény módosítási hiba:", error);
    showMessage("Az esemény módosítása nem sikerült.", true);
  }
}
async function saveCalendarEvent() {
  const eventId = $("calendarEventId").value;

  const title = $("calendarEventName").value.trim();
  const eventDate = $("calendarEventDate").value;

  if (!title || !eventDate) {
    showMessage("Add meg az esemény nevét és dátumát!", true);
    return;
  }

  const eventData = {
    title: title,
    event_type: $("calendarEventType").value,
    event_date: eventDate,
    event_time: $("calendarEventTime").value || null,
    end_time: $("calendarEventEndTime").value || null,
    description: $("calendarEventDescription").value.trim() || null,
    inquiry_id: $("calendarEventJob").value || null,
    reminder_at: $("calendarReminderAt").value
      ? new Date($("calendarReminderAt").value).toISOString()
      : null,
    updated_at: new Date().toISOString()
  };

  try {
    showMessage("Esemény mentése…");

    let result;

    if (eventId) {
      result = await supabaseClient
        .from("calendar_events")
        .update(eventData)
        .eq("id", eventId);
    } else {
      result = await supabaseClient
        .from("calendar_events")
        .insert(eventData);
    }

    if (result.error) throw result.error;

    calendarSelectedDate = eventDate;
    calendarCurrentDate = new Date(eventDate + "T12:00:00");

    closeCalendarEventForm();

    await loadCalendarEvents();

    showMessage(
      eventId
        ? "Esemény sikeresen módosítva."
        : "Új esemény sikeresen mentve."
    );

  } catch (error) {
    console.error("Naptáresemény mentési hiba:", error);
    showMessage("Az esemény mentése nem sikerült.", true);
  }
}
function showPage(page) {
  const pages = [
    "home",
    "jobs",
    "finance",
    "search",
    "calendar"
  ];

  if (!pages.includes(page)) return;

  currentPage = page;

  pages.forEach(name => {
    const element = $(name + "Page");

    if (element) {
      element.classList.toggle("hidden", name !== page);
    }
  });

  if ($("detailView")) {
    $("detailView").classList.add("hidden");
  }

  document.querySelectorAll("#bottomNavigation [data-page]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

  const titles = {
    home: "Kezdőképernyő",
    jobs: "Munkák",
    finance: "Pénzügyek",
    search: "Keresés",
    calendar: "Naptár"
  };

  $("currentPageTitle").textContent = titles[page];

  if (page === "home") renderHomeJobs();
  if (page === "finance") renderDashboardFinance();
  if (page === "search") renderSearchResults();
  if (page === "calendar") loadCalendarEvents();
}

function setupNavigation() {
  if (navigationInitialized) return;

  const navigation = $("bottomNavigation");

  if (!navigation) return;

  navigation.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");

    if (!button) return;

    currentJobId = null;
    showPage(button.dataset.page);
  });

  $("globalSearch").addEventListener("input", renderSearchResults);

  $("notificationButton").addEventListener("click", () => {
    const panel = $("notificationPanel");
    const opening = panel.classList.contains("hidden");

    panel.classList.toggle("hidden", !opening);

    $("notificationButton").setAttribute(
      "aria-expanded",
      String(opening)
    );
  });

  $("markNotificationsRead").addEventListener("click", () => {
    notificationItems = [];

    renderNotifications();
  });
$("notificationList").addEventListener("click", event => {
  const button = event.target.closest("[data-notification-job]");

  if (!button) return;

  const jobId = button.dataset.notificationJob;

  notificationItems = notificationItems.filter(
    item => item.jobId !== jobId
  );

  renderNotifications();

  $("notificationPanel").classList.add("hidden");
  $("notificationButton").setAttribute("aria-expanded", "false");

  openJob(jobId);
});
   
  $("homeJobList").addEventListener("click", event => {
    const button = event.target.closest("[data-job-id]");

    if (button) {
      openJob(button.dataset.jobId);
    }
  });
  // NAPTÁR VEZÉRLŐGOMBOK

  if (!calendarInitialized) {
    $("addCalendarEvent").addEventListener("click", () => {
      openCalendarEventForm();
    });

    $("cancelCalendarEvent").addEventListener("click", () => {
      closeCalendarEventForm();
    });

    $("calendarEventForm").addEventListener("submit", event => {
      event.preventDefault();
      saveCalendarEvent();
    });

    $("calendarPrevious").addEventListener("click", () => {
      if (calendarViewMode === "month") {
        calendarCurrentDate.setMonth(
          calendarCurrentDate.getMonth() - 1
        );
      } else {
        calendarSelectedDate = formatCalendarDate(
          new Date(
            new Date(calendarSelectedDate + "T12:00:00").getTime()
            - 7 * 24 * 60 * 60 * 1000
          )
        );
      }

      renderCalendar();
    });

    $("calendarNext").addEventListener("click", () => {
      if (calendarViewMode === "month") {
        calendarCurrentDate.setMonth(
          calendarCurrentDate.getMonth() + 1
        );
      } else {
        calendarSelectedDate = formatCalendarDate(
          new Date(
            new Date(calendarSelectedDate + "T12:00:00").getTime()
            + 7 * 24 * 60 * 60 * 1000
          )
        );
      }

      renderCalendar();
    });

    $("calendarToday").addEventListener("click", () => {
      calendarCurrentDate = new Date();
      calendarSelectedDate = today();
      renderCalendar();
    });

    document.querySelectorAll("[data-calendar-view]")
      .forEach(button => {
        button.addEventListener("click", () => {
          calendarViewMode = button.dataset.calendarView;

          document.querySelectorAll("[data-calendar-view]")
            .forEach(item => {
              item.classList.toggle("active", item === button);
            });

          renderCalendar();
        });
      });

    $("calendarGrid").addEventListener("click", event => {
      const button = event.target.closest("[data-calendar-date]");

      if (!button) return;

      calendarSelectedDate = button.dataset.calendarDate;
      calendarCurrentDate = new Date(
        calendarSelectedDate + "T12:00:00"
      );

      renderCalendar();
    });
    $("calendarDayEvents").addEventListener("click", event => {
      const button = event.target.closest("[data-calendar-action]");

      if (!button) return;

      const eventId = button.dataset.eventId;
      const action = button.dataset.calendarAction;

      const calendarEvent = calendarEvents.find(
        item => item.id === eventId
      );

      if (!calendarEvent) return;

      if (action === "edit") {
        openCalendarEventForm(calendarEvent);
      }

      if (action === "complete") {
        toggleCalendarEventCompleted(eventId);
      }

      if (action === "delete") {
        deleteCalendarEvent(eventId);
      }
    });
    calendarInitialized = true;
  }
  navigationInitialized = true;
}

function renderHomeJobs() {
  const container = $("homeJobList");

  if (!container) return;

  const jobs = inquiries.slice(0, 5);

  container.innerHTML = jobs.length
    ? jobs.map(job => `
      <button
        class="job job-button"
        type="button"
        data-job-id="${escapeHtml(job.id)}"
      >
        <div class="job-title">
          ${escapeHtml(job.customer_name || "Névtelen ügyfél")}
        </div>

        <div class="job-meta">
          ${escapeHtml(job.work_number || "Még nincs munkaszám")}
          · ${escapeHtml(job.city || "Nincs település")}
          <br>
          ${escapeHtml(job.service_type || "")}
        </div>

        <span class="status">
          ${escapeHtml(statusLabel(job.status))}
        </span>

        <div class="open-hint">Adatlap megnyitása →</div>
      </button>
    `).join("")
    : `<p class="notice">Jelenleg nincs megjeleníthető munka.</p>`;
}

function renderSearchResults() {
  const container = $("searchResults");

  if (!container) return;

  const term = $("globalSearch").value
    .trim()
    .toLocaleLowerCase("hu");

  if (!term) {
    container.innerHTML =
      `<p class="notice">Kezdj el gépelni a kereséshez.</p>`;
    return;
  }

  const results = inquiries.filter(job => {
    const searchable = [
      job.customer_name,
      job.city,
      job.work_number,
      job.service_type,
      job.customer_phone,
      job.customer_email
    ].join(" ").toLocaleLowerCase("hu");

    return searchable.includes(term);
  });

  container.innerHTML = results.length
    ? results.map(job => `
      <button
        class="job job-button"
        type="button"
        data-job-id="${escapeHtml(job.id)}"
      >
        <div class="job-title">
          ${escapeHtml(job.customer_name || "Névtelen ügyfél")}
        </div>
        <div class="job-meta">
          ${escapeHtml(job.work_number || "Még nincs munkaszám")}
          · ${escapeHtml(job.city || "")}
        </div>
        <span class="status">
          ${escapeHtml(statusLabel(job.status))}
        </span>
      </button>
    `).join("")
    : `<p class="notice">Nincs találat.</p>`;

  container.querySelectorAll("[data-job-id]").forEach(button => {
    button.addEventListener("click", () => {
      openJob(button.dataset.jobId);
    });
  });
}

function renderNotifications() {
  const container = $("notificationList");
  const badge = $("notificationBadge");

  if (!container || !badge) return;

  const count = notificationItems.length;

  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);

  container.innerHTML = count
    ? notificationItems.map(item => `
      <button
        class="notification-item"
        type="button"
        data-notification-job="${escapeHtml(item.jobId)}"
      >
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.message)}</p>
      </button>
    `).join("")
    : `<p class="notice">Jelenleg nincs új értesítés.</p>`;
}
function setupRealtimeNotifications() {
  if (notificationChannel) return;

  notificationChannel = supabaseClient
    .channel("va-electro-live-notifications")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "inquiries"
      },
      payload => {
        const job = payload.new;

        if (!job || !job.id) return;

        inquiries = [
          job,
          ...inquiries.filter(item => item.id !== job.id)
        ];

        notificationItems.unshift({
          jobId: job.id,
          title: "Új ügyfélmegkeresés",
          message:
            (job.customer_name || "Új ügyfél") +
            " – " +
            (job.service_type || "Szolgáltatás nincs megadva")
        });

        updateCounters();
        renderJobs();
        renderHomeJobs();
        renderSearchResults();
        renderNotifications();
      }
    )
    .subscribe(status => {
      if (status === "CHANNEL_ERROR") {
        console.warn("Az élő értesítések kapcsolata nem elérhető.");
      }
    });
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

  currentJobId = null;

  showPage("jobs");
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

async function loadDocuments() {
  const { data, error } = await supabaseClient
    .from("work_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  documents = data || [];
  documentsError = "";
}

async function handleDocumentSubmit(event) {
  const form = event.target;

  if (!form.matches("#documentForm")) return;

  event.preventDefault();

  if (!currentJobId) return;

  if (!navigator.onLine) {
    showMessage("Dokumentum feltöltéséhez internetkapcsolat szükséges.", true);
    return;
  }

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

    const { error: uploadError } = await supabaseClient
      .storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

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

async function openDocument(id) {
  const item = documents.find(doc => String(doc.id) === String(id));

  if (!item) {
    showMessage("A dokumentum nem található.", true);
    return;
  }

  if (!navigator.onLine) {
    showMessage("Dokumentum megnyitásához internetkapcsolat szükséges.", true);
    return;
  }

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

async function downloadDocument(id) {
  const item = documents.find(doc => String(doc.id) === String(id));

  if (!item) {
    showMessage("A dokumentum nem található.", true);
    return;
  }

  if (!navigator.onLine) {
    showMessage("Dokumentum letöltéséhez internetkapcsolat szükséges.", true);
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

  document.querySelectorAll(".app-page").forEach(page => {
  page.classList.add("hidden");
});

$("detailView").classList.remove("hidden");

document.querySelectorAll("#bottomNavigation [data-page]")
  .forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === "jobs"
    );
  });

$("currentPageTitle").textContent = "Munka adatlap";

updateJobNavigation();
showMessage("Munka adatlap megnyitva.");
}

/* =========================================
   OFFLINE MÓDOSÍTÁSI VÁRÓLISTA
========================================= */

async function persistOfflineSnapshot() {
  await saveUnlockedOfflineData({
    inquiries,
    payments,
    materialCosts,
    pendingOfflineChanges,
    savedAt: new Date().toISOString()
  });
}

async function queueOfflineChange(change) {
  if (!offlineCryptoKey) {
    throw new Error("Az offline tárhely nincs feloldva PIN-kóddal.");
  }

  const queuedChange = {
    ...change,
    operationId: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };

  pendingOfflineChanges.push(queuedChange);

  try {
    await persistOfflineSnapshot();

    // A létrehozott várólistás elemet visszaadjuk.
    return queuedChange;

  } catch (error) {
    pendingOfflineChanges =
      pendingOfflineChanges.filter(
        item => item.operationId !== queuedChange.operationId
      );

    throw error;
  }
}

/* =========================================
   PÉNZÜGYI ŰRLAPOK
   ONLINE ÉS OFFLINE MENTÉS
========================================= */

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
    /*
      OFFLINE MENTÉS
    */

    if (!navigator.onLine) {
      if (!offlineCryptoKey) {
        throw new Error(
          "Az offline tárhely nincs feloldva. Lépj be az offline PIN-kóddal."
        );
      }

      if (editId) {
        throw new Error(
          "A már rögzített pénzügyi tételek módosítása jelenleg csak online lehetséges."
        );
      }

      const localId = "offline-" + crypto.randomUUID();

      const localItem = {
        id: localId,
        ...values
      };

      if (isPayment) {
        payments.push(localItem);
      } else {
        materialCosts.push(localItem);
      }

      try {
        await queueOfflineChange({
          type: isPayment ? "payment_insert" : "material_insert",
          localId,
          values
        });

      } catch (storageError) {
        // Ha a titkosított mentés nem sikerült,
        // a helyi listából is eltávolítjuk a tételt.

        if (isPayment) {
          payments = payments.filter(item => item.id !== localId);
        } else {
          materialCosts = materialCosts.filter(item => item.id !== localId);
        }

        throw storageError;
      }

      openJob(currentJobId);

      showMessage(
        isPayment
          ? "Offline részfizetés mentve. Internetkapcsolat esetén automatikusan szinkronizálódik."
          : "Offline anyagköltség mentve. Internetkapcsolat esetén automatikusan szinkronizálódik."
      );

      return;
    }

    /*
      ONLINE MÓDOSÍTÁS / ÚJ TÉTEL
    */

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

    if (job) {
      openJob(currentJobId);
    }

    if (offlineCryptoKey) {
      try {
        await persistOfflineSnapshot();
      } catch (storageError) {
        console.error(
          "Offline pénzügyi mentés frissítése sikertelen:",
          storageError
        );
      }
    }

    showMessage(
      isPayment
        ? "A részfizetés sikeresen mentve."
        : "Az anyagköltség sikeresen mentve."
    );

  } catch (error) {
    showMessage("Pénzügyi mentési hiba: " + error.message, true);

    if (button.isConnected) {
      button.disabled = false;
      button.textContent = isPayment
        ? "Részfizetés mentése"
        : "Anyagköltség mentése";
    }
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
  if (!navigator.onLine) {
    showMessage(
      "Pénzügyi tételek szerkesztése jelenleg csak online lehetséges.",
      true
    );
    return;
  }

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
  if (!navigator.onLine) {
    showMessage(
      "Pénzügyi tételek törlése jelenleg csak online lehetséges.",
      true
    );
    return;
  }

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

    if (offlineCryptoKey) {
      await persistOfflineSnapshot();
    }

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

  if (!navigator.onLine) {
    showMessage(
      "Az adminisztrációs megjegyzés módosításához internetkapcsolat szükséges.",
      true
    );
    return;
  }

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

    if (offlineCryptoKey) {
      await persistOfflineSnapshot();
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

  const job = inquiries.find(item => item.id === currentJobId);
  if (!job) return;

  button.disabled = true;
  button.textContent = "Mentés…";

  try {
    if (!navigator.onLine) {
      const oldStatus = job.status;

      job.status = newStatus;

      try {
        await queueOfflineChange({
          type: "status",
          inquiryId: currentJobId,
          value: newStatus
        });
      } catch (error) {
        job.status = oldStatus;
        throw error;
      }

      if (currentFilter !== "all") {
        currentFilter = newStatus;
      }

      updateCounters();
      renderJobs();
      renderDashboardFinance();
      openJob(currentJobId);

      showMessage("Offline mentés sikeres. Szinkronizálásra vár.");
      return;
    }

    const { error } = await supabaseClient
      .from("inquiries")
      .update({ status: newStatus })
      .eq("id", currentJobId);

    if (error) throw error;

    job.status = newStatus;

    if (currentFilter !== "all") {
      currentFilter = newStatus;
    }

    if (offlineCryptoKey) {
      try {
        await persistOfflineSnapshot();
      } catch (storageError) {
        console.error(
          "Offline mentés frissítése sikertelen:",
          storageError
        );
      }
    }

    updateCounters();
    renderJobs();
    renderDashboardFinance();
    openJob(currentJobId);

    showMessage("A munka állapota sikeresen módosult.");

  } catch (error) {
    showMessage("Mentési hiba: " + error.message, true);

  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = "Állapot mentése";
    }
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
  const container = $("financePageContent");

  if (!container) return;

  if ($("dashboardFinanceContent")) return;

  container.innerHTML = `
    <h2>Pénzügyi áttekintés</h2>

    <div id="dashboardFinanceContent">
      <p class="notice">Pénzügyi adatok betöltése…</p>
    </div>
  `;
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

setupNavigation();
showPage("home");

createDetailView();
createJobControls();
createDashboardFinance();
addAppStyles();

updateCounters();
renderJobs();
renderHomeJobs();
renderSearchResults();
renderNotifications();
renderDashboardFinance();

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

  try {
    await loadDocuments();
  } catch (documentError) {
    console.error("Dokumentumok betöltési hibája:", documentError);
    documents = [];
    documentsError = documentError.message;
  }

  updateCounters();
renderJobs();
renderHomeJobs();
renderSearchResults();
renderDashboardFinance();
renderNotifications();
setupRealtimeNotifications();
  showMessage("Kapcsolódva a VA ELECTRO adatbázishoz.");
}

/* =========================================
   BEJELENTKEZÉS
========================================= */

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

    const offlineDataExists = await hasOfflineData();

    if (!offlineDataExists) {
      showPinLogin(
        "Állítsd be az offline hozzáférés PIN-kódját.",
        true
      );

      return;
    }

    /*
      Ha már létezik titkosított offline mentés,
      mindig kérjük be a PIN-kódot.

      Ezzel feloldjuk a korábbi adatokat,
      és a várólistás módosításokat is szinkronizáljuk.
    */

    offlineCryptoKey = null;

    showPinLogin(
      "Add meg a meglévő offline PIN-kódot az adatok feloldásához és szinkronizálásához.",
      false
    );

  } catch (error) {
    showLogin(error.message || "Nem sikerült belépni.");

    try {
      await supabaseClient.auth.signOut();
    } catch (signOutError) {
      console.error("Kijelentkezési hiba:", signOutError);
    }

  } finally {
    $("loginButton").disabled = false;
    $("loginButton").textContent = "Biztonságos belépés";
  }
});

/* =========================================
   PIN-KÓDOS BELÉPÉS
========================================= */

$("pinForm").addEventListener("submit", async event => {
  event.preventDefault();

  const pin = $("offlinePin").value;
  const button = $("pinForm").querySelector('button[type="submit"]');

  button.disabled = true;

  try {
    if (!/^[0-9]{8,}$/.test(pin)) {
      throw new Error("Legalább 8 számjegyű PIN-kód szükséges.");
    }

    /*
      ELSŐ PIN-BEÁLLÍTÁS
    */

    if (offlinePinSetupMode) {
      const confirmation = $("offlinePinConfirm").value;

      if (pin !== confirmation) {
        throw new Error("A két PIN-kód nem egyezik.");
      }

      if (!navigator.onLine) {
        throw new Error("A PIN első beállításához internetkapcsolat szükséges.");
      }

      await checkAdmin();
      await loadDashboard();

      pendingOfflineChanges = [];

      await saveOfflineData(pin, {
        inquiries,
        payments,
        materialCosts,
        pendingOfflineChanges,
        savedAt: new Date().toISOString()
      });

      showMessage("A titkosított offline mentés elkészült.");
      return;
    }

    /*
      MEGLÉVŐ TITKOSÍTOTT ADATOK FELOLDÁSA
    */

    const offlineData = await loadOfflineData(pin);

    inquiries = offlineData.inquiries || [];
    payments = offlineData.payments || [];
    materialCosts = offlineData.materialCosts || [];
    pendingOfflineChanges = offlineData.pendingOfflineChanges || [];
    documents = [];

    showDashboard();
    setupNavigation();
    showPage("home");
    createDetailView();
    createJobControls();
    createDashboardFinance();
    addAppStyles();

    updateCounters();
renderJobs();
renderHomeJobs();
renderSearchResults();
renderNotifications();
renderDashboardFinance();

    /*
      HA VAN INTERNET:
      1. Admin ellenőrzés.
      2. Függő offline módosítások szinkronizálása.
      3. Friss szerveradatok letöltése.
      4. Új titkosított offline mentés.
    */

    if (navigator.onLine) {
      showMessage("PIN elfogadva. Szinkronizálás folyamatban…");

      await checkAdmin();

      if (pendingOfflineChanges.length > 0) {
        await syncOfflineChanges();
      }

      await loadDashboard();
      await persistOfflineSnapshot();

      showMessage("Az offline módosítások szinkronizálása sikeres.");

    } else {
      showMessage("Offline mód – a korábban mentett adatok betöltve.");
    }

  } catch (error) {
    $("pinError").textContent =
      error.message === "The operation failed for an operation-specific reason"
        ? "Hibás PIN-kód vagy sérült titkosított adat."
        : error.message || "Nem sikerült a PIN-művelet.";

  } finally {
    button.disabled = false;
  }
});

$("onlineLoginButton").addEventListener("click", () => {
  offlineCryptoKey = null;
  showLogin();
});

/* KIJELENTKEZÉS */

$("logoutButton").addEventListener("click", async () => {
  try {
    if (offlineCryptoKey) {
      await persistOfflineSnapshot();
    }

    await supabaseClient.auth.signOut();

    offlineCryptoKey = null;

    showLogin("Sikeres kijelentkezés.");

  } catch (error) {
    showMessage("Kijelentkezési hiba: " + error.message, true);
  }
});

/* =========================================
   OFFLINE MÓDOSÍTÁSOK SZINKRONIZÁLÁSA
========================================= */

async function syncOfflineChanges() {
  if (!navigator.onLine || !offlineCryptoKey) return;

  if (offlineSyncRunning) return;

  offlineSyncRunning = true;

  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error("A szinkronizáláshoz online bejelentkezés szükséges.");
    }

    await checkAdmin();

    while (pendingOfflineChanges.length > 0) {
      const change = pendingOfflineChanges[0];

      /*
        MUNKAÁLLAPOT SZINKRONIZÁLÁSA
      */

      if (change.type === "status") {
        if (!change.inquiryId || !change.value) {
          throw new Error("Hiányos offline állapotmódosítás.");
        }

        const { data, error } = await supabaseClient
          .from("inquiries")
          .update({ status: change.value })
          .eq("id", change.inquiryId)
          .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(
            "A módosítandó munka nem található az adatbázisban."
          );
        }
      }

      /*
        OFFLINE RÉSZFIZETÉS SZINKRONIZÁLÁSA
      */

      else if (change.type === "payment_insert") {
        if (!change.values || !change.localId) {
          throw new Error("Hiányos offline részfizetési adat.");
        }

        const { data, error } = await supabaseClient
          .from("work_payments")
          .insert(change.values)
          .select()
          .single();

        if (error) throw error;

        /*
          A helyi ideiglenes azonosítót
          lecseréljük a szerver által adott azonosítóra.
        */

        payments = payments.map(item =>
          String(item.id) === String(change.localId)
            ? data
            : item
        );
      }

      /*
        OFFLINE ANYAGKÖLTSÉG SZINKRONIZÁLÁSA
      */

      else if (change.type === "material_insert") {
        if (!change.values || !change.localId) {
          throw new Error("Hiányos offline anyagköltség-adat.");
        }

        const { data, error } = await supabaseClient
          .from("work_material_costs")
          .insert(change.values)
          .select()
          .single();

        if (error) throw error;

        materialCosts = materialCosts.map(item =>
          String(item.id) === String(change.localId)
            ? data
            : item
        );
      }

      else {
        throw new Error(
          "Nem támogatott offline módosítás: " + change.type
        );
      }

      /*
        Csak akkor vesszük ki a várólistából,
        ha a szerveres művelet sikeresen lefutott.
      */

      pendingOfflineChanges.shift();

      await persistOfflineSnapshot();
    }

    return true;

  } finally {
    offlineSyncRunning = false;
  }
}

/* INTERNETKAPCSOLAT VISSZATÉRÉSE */

window.addEventListener("online", async () => {
  if ($("dashboardView").classList.contains("hidden")) return;

  try {
    showMessage("Internetkapcsolat helyreállt. Szinkronizálás…");

    if (offlineCryptoKey && pendingOfflineChanges.length > 0) {
      await syncOfflineChanges();
    }

    await loadDashboard();

    if (offlineCryptoKey) {
      await persistOfflineSnapshot();
    }

    showMessage("Az adatok szinkronizálása sikeres.");

  } catch (error) {
    showMessage(
      "A szinkronizálás nem sikerült. A függő módosítások megmaradtak: " +
      error.message,
      true
    );
  }
});

/* =========================================
   TITKOSÍTOTT OFFLINE TÁROLÁS
========================================= */

const OFFLINE_DB_NAME = "va-electro-offline";
const OFFLINE_STORE_NAME = "secure";
const OFFLINE_DATA_KEY = "encrypted-data";

function openOfflineDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deriveOfflineKey(pin, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256"
    },
    material,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getOfflineRecord() {
  const db = await openOfflineDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        OFFLINE_STORE_NAME,
        "readonly"
      );

      const request = transaction.objectStore(
        OFFLINE_STORE_NAME
      ).get(OFFLINE_DATA_KEY);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeOfflineRecord(record) {
  const db = await openOfflineDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        OFFLINE_STORE_NAME,
        "readwrite"
      );

      transaction.objectStore(OFFLINE_STORE_NAME).put(
        record,
        OFFLINE_DATA_KEY
      );

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

async function encryptOfflineData(key, salt, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );

  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    encrypted: Array.from(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString()
  };
}

async function saveOfflineData(pin, data) {
  if (!pin || !/^[0-9]{8,}$/.test(pin)) {
    throw new Error("Legalább 8 számjegyű PIN-kód szükséges.");
  }

  const existing = await getOfflineRecord();

  const salt = existing
    ? new Uint8Array(existing.salt)
    : crypto.getRandomValues(new Uint8Array(16));

  const key = await deriveOfflineKey(pin, salt);

  const record = await encryptOfflineData(key, salt, data);

  await writeOfflineRecord(record);

  offlineCryptoKey = key;

  return true;
}

async function saveUnlockedOfflineData(data) {
  if (!offlineCryptoKey) {
    throw new Error("Előbb fel kell oldani az offline tárhelyet PIN-kóddal.");
  }

  const existing = await getOfflineRecord();

  if (!existing) {
    throw new Error("Nem található offline adattárolás.");
  }

  const salt = new Uint8Array(existing.salt);

  const record = await encryptOfflineData(
    offlineCryptoKey,
    salt,
    data
  );

  await writeOfflineRecord(record);

  return true;
}

async function loadOfflineData(pin) {
  const record = await getOfflineRecord();

  if (!record) {
    throw new Error("Még nincs mentett offline adat.");
  }

  const salt = new Uint8Array(record.salt);

  const key = await deriveOfflineKey(pin, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(record.iv)
      },
      key,
      new Uint8Array(record.encrypted)
    );

    const data = JSON.parse(
      new TextDecoder().decode(decrypted)
    );

    offlineCryptoKey = key;

    return data;

  } catch (error) {
    offlineCryptoKey = null;
    throw new Error("Hibás PIN-kód vagy sérült offline adat.");
  }
}

async function hasOfflineData() {
  const record = await getOfflineRecord();
  return !!record;
}

/* =========================================
   ALKALMAZÁS INDÍTÁSA
========================================= */

async function startApp() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }

  try {
    if (!navigator.onLine) {
      const offlineDataExists = await hasOfflineData();

      if (offlineDataExists) {
        showPinLogin(
          "Add meg az offline PIN-kódodat a mentett adatok megnyitásához."
        );
      } else {
        showLogin("Az első offline használathoz előbb online kell belépni.");
      }

      return;
    }

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      showLogin();
      return;
    }

    await checkAdmin();

    /*
      Ha van már titkosított offline adat,
      kérjük be a PIN-kódot akkor is,
      ha a Supabase-munkamenet még aktív.
    */

    const offlineDataExists = await hasOfflineData();

    if (offlineDataExists) {
      showPinLogin(
        "Add meg a meglévő offline PIN-kódot az adatok feloldásához."
      );

      return;
    }

    await loadDashboard();

  } catch (error) {
    if (!navigator.onLine) {
      const offlineDataExists = await hasOfflineData();

      if (offlineDataExists) {
        showPinLogin();
        return;
      }
    }

    try {
      await supabaseClient.auth.signOut();
    } catch (signOutError) {
      console.error("Kijelentkezési hiba:", signOutError);
    }

    showLogin(error.message || "A munkamenet ellenőrzése nem sikerült.");
  }
}

startApp();
