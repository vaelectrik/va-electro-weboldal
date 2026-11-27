(() => {
  const form = document.querySelector("#expenseForm");
  const month = document.querySelector("#expenseMonth");
  const list = document.querySelector("#expenseList");
  const note = document.querySelector("#expenseNote");
  const amount = document.querySelector("#expenseAmount");
  const total = document.querySelector("#expenseTotal");
  const status = document.querySelector("#expenseStatus");
  let generation = 0;
  function monthKey() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone:'Europe/Budapest', year:'numeric', month:'2-digit', day:'2-digit'
    }).format(new Date());
  }

  async function render() {
    const request = ++generation;
    if (!navigator.onLine) {
      list.replaceChildren();
      total.textContent = "–";
      status.textContent = "A kiadásokhoz internetkapcsolat szükséges.";
      return;
    }
    let query = supabaseClient.from("business_expenses").select("note,amount,expense_date")
      .order("expense_date", { ascending: false }).order("created_at", { ascending: false });
    if (month.value) {
      const [year, number] = month.value.split("-").map(Number);
      const end = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
      query = query.gte("expense_date", month.value + "-01").lt("expense_date", end);
    }
    const {data,error} = await query;
    if (request !== generation) return;
    if (error) {
      status.textContent = "A kiadások betöltése sikertelen.";
      return;
    }
    const entries = data || [];
    total.textContent = window.formatMoney(entries.reduce((sum, item) => sum + Number(item.amount), 0));
    list.replaceChildren();
    if (!entries.length) list.textContent = "Erre a hónapra még nincs rögzített kiadás.";
    for (const item of entries) {
      const row = document.createElement("div");
      row.className = "expense-row";
      const description = document.createElement("span");
      description.textContent = item.note;
      const date = document.createElement("small");
      date.textContent = item.expense_date.replaceAll("-", ".");
      description.append(date);
      const cost = document.createElement("strong");
      cost.textContent = window.formatMoney(item.amount);
      row.append(description,cost);
      list.append(row);
    }
  }

  document.querySelectorAll("[data-finance-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const expenses = button.dataset.financeTab === "expenses";
      document.querySelectorAll("[data-finance-tab]").forEach(tab => tab.setAttribute("aria-pressed",String(tab === button)));
      document.querySelector("#financeOverview").classList.toggle("hidden",expenses);
      document.querySelector("#expensePanel").classList.toggle("hidden",!expenses);
      if (expenses) render();
    });
  });
  month.value = monthKey().slice(0,7);
  month.addEventListener("change", render);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    const value = Number(amount.value);
    const text = note.value.trim();
    if (!text || !Number.isSafeInteger(value) || value <= 0) {
      status.textContent = "Adj meg egy megjegyzést és egy pozitív összeget.";
      return;
    }
    if (!navigator.onLine) {
      status.textContent = "A mentéshez internetkapcsolat szükséges.";
      return;
    }
    const submit = form.querySelector("button");
    submit.disabled = true;
    try {
      const {data, error} = await supabaseClient.from("business_expenses")
        .insert({ note:text, amount:value }).select("expense_date").single();
      if (error) throw error;
      month.value = data.expense_date.slice(0,7);
      form.reset();
      status.textContent = "A kiadást rögzítettük.";
      await render();
    } catch {
      status.textContent = "A kiadás mentése sikertelen.";
    } finally { submit.disabled = false; }
  });
})();
