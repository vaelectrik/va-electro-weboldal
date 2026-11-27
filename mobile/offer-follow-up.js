(() => {
  function phoneNumber(value) {
    const raw = String(value ?? "").trim();
    if (!/^(?:\+|00)?[\d\s().-]+$/.test(raw)) return "";
    const compact = raw.replace(/[\s().-]/g, "");
    const normalized = compact.startsWith("00") ? "+" + compact.slice(2)
      : compact.startsWith("06") ? "+36" + compact.slice(2)
      : compact;
    return /^\+?\d{7,15}$/.test(normalized) ? normalized : "";
  }

  function message(job, now) {
    // Customer names are entered in Hungarian order: family name, then given name.
    const name = String(job.customer_name ?? "").trim().split(/\s+/).at(-1);
    const givenName = /^(?:kft|bt|kkt|zrt|nyrt|ev|nonprofit)$/i.test(name.replaceAll(".", "")) ? "" : name;
    const greeting = givenName ? "Jó napot kívánok, " + givenName + "!" : "Jó napot kívánok!";
    const deadline = window.offerDeadlines.get(job, now);
    const remaining = deadline?.remaining;
    const validity = remaining === undefined ? ""
      : remaining < 0 ? "Az ajánlat érvényessége lejárt."
      : remaining === 0 ? "Az ajánlat ma jár le."
      : remaining === 1 ? "Az ajánlat holnap jár le."
      : "Az ajánlat " + remaining + " nap múlva lejár.";
    return [
      greeting,
      "Megkapta az árajánlatot, és sikerült már döntenie?",
      validity,
      "Üdvözlettel, Vörös Ákos – VA ELECTRO"
    ].filter(Boolean).join(" ");
  }

  function smsLink(phone, text) {
    return "sms:" + phone + "?body=" + encodeURIComponent(text);
  }

  window.offerFollowUp = { phoneNumber, message, smsLink };

  const dialog = document.querySelector("#offerSmsDialog");
  if (!dialog) return;
  const body = document.querySelector("#offerSmsText");
  const to = document.querySelector("#offerSmsTo");
  const open = document.querySelector("#openOfferSms");
  const copy = document.querySelector("#copyOfferSms");
  const status = document.querySelector("#offerSmsStatus");
  let phone = "";

  function updateLink() {
    const canOpen = Boolean(phone) && Boolean(body.value.trim());
    open.hidden = !canOpen;
    if (canOpen) open.href = smsLink(phone, body.value);
    else open.removeAttribute("href");
  }

  body.addEventListener("input", updateLink);
  document.querySelector("#closeOfferSms").addEventListener("click", () => dialog.close());
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(body.value);
      status.textContent = "Az üzenet a vágólapra került.";
    } catch {
      body.focus();
      body.select();
      status.textContent = "Jelöltem a szöveget. A készülék Másolás gombjával másolhatod.";
    }
  });

  window.offerFollowUp.open = job => {
    phone = phoneNumber(job.customer_phone);
    to.textContent = phone ? "Címzett: " + phone : "Ehhez az ajánlathoz nincs használható telefonszám.";
    body.value = message(job);
    status.textContent = "";
    updateLink();
    dialog.showModal();
  };
})();
