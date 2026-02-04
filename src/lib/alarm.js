const FIRED_KEY = "vk7days_fired_v1";

/* ---------------- Notifications ---------------- */
export async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

/* ---------------- Alarm tick logic ---------------- */
function todayKey() {
  const map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return map[new Date().getDay()];
}

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadFired() {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveFired(map) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {}
}

function hhmmNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * tick(schedule, onFire)
 * - schedule shape: { monday: [task...], ... }
 * - calls onFire(task, dayKey) ONCE per dayKey+time+task.id
 * - check interval is managed by caller (App.jsx does it every 5s)
 */
export function tick(schedule, onFire) {
  const day = todayKey();
  const tasks = Array.isArray(schedule?.[day]) ? schedule[day] : [];
  const fired = loadFired();

  const hhmm = hhmmNow();
  const base = `${ymd(new Date())}_${day}_${hhmm}`;

  for (const t of tasks) {
    if (!t?.enabled) continue;
    if (t.time !== hhmm) continue;

    const fireKey = `${base}_${t.id}`;
    if (fired[fireKey]) continue;

    fired[fireKey] = true;
    saveFired(fired);
    onFire(t, day);
  }
}
