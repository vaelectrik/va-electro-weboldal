(() => {
  const dayMs = 86400000;
  const budapest = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const displayDate = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "UTC", year: "numeric", month: "short", day: "numeric"
  });

  function dayNumber(value) {
    const date = new Date(value);
    if (!Number.isFinite(+date)) return null;
    const parts = Object.fromEntries(budapest.formatToParts(date).map(({type, value}) => [type, value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day) / dayMs;
  }

  function get(job, now = new Date()) {
    if (job.status !== "offer_sent" || job.deleted_at || !job.offer_sent_at) return null;
    const start = dayNumber(job.offer_sent_at);
    const today = dayNumber(now);
    if (start === null || today === null) return null;
    const end = start + 15;
    const remaining = end - today;
    const deadline = displayDate.format(end * dayMs);
    const label = remaining < 0 ? "Lejárt"
      : remaining === 0 ? "Ma jár le"
      : remaining === 1 ? "Holnap jár le"
      : remaining + " nap van hátra";
    return { remaining, deadline, label, end, urgent: remaining >= 0 && remaining <= 3 };
  }

  function sentAtForStatus(previous, next, now = new Date()) {
    return next === "offer_sent" && previous.status !== "offer_sent"
      ? now.toISOString() : previous.offer_sent_at;
  }

  window.offerDeadlines = { get, dayNumber, sentAtForStatus };
})();
