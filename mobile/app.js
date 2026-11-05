
const SUPABASE_URL = "https://fxxhxnpirxpjqadrwyzf.supabase.co";
const SUPABASE_ANON_KEY = "IDE_MASOLD_A_MEGLEVO_SB_PUBLISHABLE_KULCSOT";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

const loginView = $("loginView");
const dashboardView = $("dashboardView");
const loginForm = $("loginForm");
const loginButton = $("loginButton");
const loginError = $("loginError");
const appMessage = $("appMessage");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function showMessage(message = "", isError = false) {
  appMessage.textContent = message;
  appMessage.className = isError ? "error" : "notice";
}

function showLogin(message = "") {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  loginError.textContent = message;
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

async function checkAdmin() {
  const { data, error } = await supabaseClient.rpc(
    "is_va_electro_admin"
  );

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
    accepted: "Elfogadva – aktív munka"
  })[status] || status;
}

async function loadDashboard() {
  showDashboard();

  if (!navigator.onLine) {
    $("newCount").textContent = "–";
    $("activeCount").textContent = "–";
    $("completedCount").textContent = "–";

    $("jobList").innerHTML =
      '<p class="notice">Offline mód – az online adatok most nem érhetők el.</p>';

    showMessage("Offline állapot.");
    return;
  }

  showMessage("Adatok betöltése…");

  const { data: rows, error } = await supabaseClient
    .from("inquiries")
    .select("id, customer_name, city, service_type, status, work_number, preferred_date")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const inquiries = rows || [];

  $("newCount").textContent =
    inquiries.filter(x => x.status === "new").length;

  $("activeCount").textContent =
    inquiries.filter(x => x.status === "accepted").length;

  $("completedCount").textContent =
    inquiries.filter(x => x.status === "completed").length;

  const active = inquiries.filter(x =>
    ["new", "contacted", "offer_sent", "accepted"].includes(x.status)
  );

  $("jobList").innerHTML = active.length
    ? active.map(item => `
      <article class="job">
        <div class="job-title">${escapeHtml(item.customer_name)}</div>
        <div class="job-meta">
          ${escapeHtml(item.work_number || "Még nincs munkaszám")}
          · ${escapeHtml(item.city || "Nincs település")}
          <br>
          ${escapeHtml(item.service_type)}
        </div>
        <span class="status">${escapeHtml(statusLabel(item.status))}</span>
      </article>
    `).join("")
    : '<p class="notice">Jelenleg nincs aktív megkeresés vagy munka.</p>';

  showMessage("Kapcsolódva a VA ELECTRO adatbázishoz.");
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginButton.disabled = true;
  loginButton.textContent = "Belépés…";
  loginError.textContent = "";

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await checkAdmin();
    await loadDashboard();

  } catch (error) {
    await supabaseClient.auth.signOut();
    showLogin(error.message || "Nem sikerült belépni.");

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Biztonságos belépés";
  }
});

$("logoutButton").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin("Sikeres kijelentkezés.");
});

window.addEventListener("online", () => {
  if (!dashboardView.classList.contains("hidden")) {
    loadDashboard().catch(error =>
      showMessage(error.message, true)
    );
  }
});

window.addEventListener("offline", () => {
  if (!dashboardView.classList.contains("hidden")) {
    loadDashboard().catch(error =>
      showMessage(error.message, true)
    );
  }
});

async function startApp() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.warn("Offline mód:", error));
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
