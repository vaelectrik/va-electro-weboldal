
const SUPABASE_URL = "https://fxxhxnpirxpjqadrwyzf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Zpk6zDDtgqFpkDc38ms6_g_gjzvn-ZS";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let inquiries = [];

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
  if (value === null || value === undefined || value === "") return "Nincs megadva";
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

async function checkAdmin() {
  const { data, error } = await supabaseClient.rpc("is_va_electro_admin");

  if (error) throw error;
  if (data !== true) {
    throw new Error("Ehhez a fiókhoz nincs admin jogosultság.");
  }
}

function statusLabel(status) {
  return ({
    new: "Új megkeresés",
    contacted: "Kapcsolatfelvétel",
    offer_sent: "Ajánlat elküldve",
    accepted: "Elfogadva – aktív munka",
    completed: "Elkészült",
    rejected: "Elutasítva",
    closed: "Lezárva"
  })[status] || status || "Nincs megadva";
}

// Részletes adatlap létrehozása
function createDetailView() {
  if ($("detailView")) return;

  const detail = document.createElement("section");
  detail.id = "detailView";
  detail.className = "panel hidden";

  detail.innerHTML = `
    <button id="backToJobs" class="secondary">← Vissza a munkákhoz</button>
    <div id="detailContent"></div>
  `;

  $("dashboardView").appendChild(detail);

  $("backToJobs").addEventListener("click", () => {
    detail.classList.add("hidden");
    document.querySelector(".grid").classList.remove("hidden");
    $("jobsPanel").classList.remove("hidden");
    showMessage("Munkalista");
  });
}

function detailRow(label, value) {
  if (value === null || value === undefined || value === "") return "";

  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function openJob(id) {
  const job = inquiries.find(item => item.id === id);
  if (!job) return;

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

    <h3>Pénzügyi adatok</h3>
    ${detailRow("Becsült összeg", formatMoney(job.estimated_price))}
    ${detailRow("Ajánlati összeg", formatMoney(job.offer_amount))}
    ${detailRow("Elfogadott összeg", formatMoney(job.accepted_amount))}

    <h3>Munka részletei</h3>
    ${detailRow("Leírás", job.description)}
    ${detailRow("Hibakeresési összefoglaló", job.troubleshooting_summary)}

    <h3>Adminisztráció</h3>
    ${detailRow("Admin megjegyzés", job.admin_notes)}
    ${detailRow("Ajánlat elküldve", job.offer_sent_at)}
    ${detailRow("Létrehozva", job.created_at ? new Date(job.created_at).toLocaleString("hu-HU") : "")}
  `;

  document.querySelector(".grid").classList.add("hidden");
  $("jobsPanel").classList.add("hidden");
  $("detailView").classList.remove("hidden");

  showMessage("Munk adatlap megnyitva.");
}

function renderJobs() {
  const active = inquiries.filter(item =>
    ["new", "contacted", "offer_sent", "accepted"].includes(item.status)
  );

  $("jobList").innerHTML = active.length
    ? active.map(item => `
      <button class="job job-button" type="button"
        data-job-id="${escapeHtml(item.id)}">
        <div class="job-title">${escapeHtml(item.customer_name)}</div>
        <div class="job-meta">
          ${escapeHtml(item.work_number || "Még nincs munkaszám")}
          · ${escapeHtml(item.city || "Nincs település")}
          <br>${escapeHtml(item.service_type)}
        </div>
        <span class="status">${escapeHtml(statusLabel(item.status))}</span>
        <div class="open-hint">Adatlap megnyitása →</div>
      </button>
    `).join("")
    : '<p class="notice">Jelenleg nincs aktív megkeresés vagy munka.</p>';
}

async function loadDashboard() {
  showDashboard();
  createDetailView();

  if (!navigator.onLine) {
    showMessage("Offline állapot – az online adatok nem érhetők el.");
    return;
  }

  showMessage("Adatok betöltése…");

  const { data, error } = await supabaseClient
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  inquiries = data || [];

  $("newCount").textContent =
    inquiries.filter(x => x.status === "new").length;

  $("activeCount").textContent =
    inquiries.filter(x => x.status === "accepted").length;

  $("completedCount").textContent =
    inquiries.filter(x => x.status === "completed").length;

  renderJobs();
  showMessage("Kapcsolódva a VA ELECTRO adatbázishoz.");
}

// Munkára koppintás
$("jobList").addEventListener("click", event => {
  const button = event.target.closest("[data-job-id]");
  if (!button) return;

  openJob(button.dataset.jobId);
});

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

$("logoutButton").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin("Sikeres kijelentkezés.");
});

window.addEventListener("online", () => {
  if (!$("dashboardView").classList.contains("hidden")) {
    loadDashboard().catch(error => showMessage(error.message, true));
  }
});

async function startApp() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }

  try {
    const { data: { session } } =
      await supabaseClient.auth.getSession();

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
