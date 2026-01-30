const SCHED_KEY = "vk7days_scheduled_notifications_v1";

function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function loadMap() {
  try {
    return JSON.parse(localStorage.getItem(SCHED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMap(map) {
  try {
    localStorage.setItem(SCHED_KEY, JSON.stringify(map || {}));
  } catch {}
}

function dayIndex(dayKey) {
  const map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return map.indexOf(String(dayKey || "").toLowerCase());
}


/**
 * Returns next occurrence timestamp (ms) for the given weekly day + HH:MM.
 */
export function nextOccurrenceTimestampMs(dayKey, hhmm, now = new Date()) {
  const idx = dayIndex(dayKey);
  if (idx < 0) return null;

  const [hhRaw, mmRaw] = String(hhmm || "").split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const d = new Date(now.getTime());
  const todayIdx = d.getDay();
  const daysAhead = (idx - todayIdx + 7) % 7;

  d.setHours(hh, mm, 0, 0);
  if (daysAhead === 0 && d.getTime() <= now.getTime()) {
    // time already passed today -> schedule next week
    d.setDate(d.getDate() + 7);
  } else {
    d.setDate(d.getDate() + daysAhead);
  }
  return d.getTime();
}

export function canScheduleTriggeredNotifications() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "TimestampTrigger" in window
  );
}

/**
 * Best-effort scheduling:
 * - If Notification Trigger API is supported, schedule a system notification at the next occurrence.
 * - Uses a stable `tag` per task to reduce duplicates (when supported).
 *
 * IMPORTANT: Browsers do NOT allow background TTS audio. This schedules notifications only.
 */
export async function scheduleTriggeredNotificationForTask(task, dayKey) {
  if (!task?.id || !task?.time) return { ok: false, reason: "missing_task" };
  if (!task?.enabled) return { ok: false, reason: "disabled" };

  if (!canScheduleTriggeredNotifications()) return { ok: false, reason: "not_supported" };
  if (typeof Notification === "undefined") return { ok: false, reason: "no_notification" };
  if (Notification.permission !== "granted") return { ok: false, reason: "no_permission" };

  const ts = nextOccurrenceTimestampMs(dayKey, task.time, new Date());
  if (!ts) return { ok: false, reason: "bad_time" };

  const map = loadMap();
  const key = String(task.id);
  if (map[key] === ts) return { ok: true, scheduledAt: ts, skipped: true };

  try {
    const reg = await navigator.serviceWorker.ready;
    const trigger = new window.TimestampTrigger(ts);
    await reg.showNotification("VK7Days Reminder", {
      body: `${cleanStr(task.title)} (${task.time})`,
      tag: `vk7_${task.id}`,
      renotify: true,
      requireInteraction: true,
      showTrigger: trigger,
    });

    map[key] = ts;
    saveMap(map);
    return { ok: true, scheduledAt: ts };
  } catch {
    return { ok: false, reason: "schedule_failed" };
  }
}


export async function syncAllTriggeredNotifications(scheduleByDay) {
  if (!canScheduleTriggeredNotifications()) return { ok: false, reason: "not_supported" };
  if (typeof Notification === "undefined") return { ok: false, reason: "no_notification" };
  if (Notification.permission !== "granted") return { ok: false, reason: "no_permission" };

  const results = [];
  const dayKeys = Object.keys(scheduleByDay || {});
  for (const dayKey of dayKeys) {
    const list = Array.isArray(scheduleByDay?.[dayKey]) ? scheduleByDay[dayKey] : [];
    for (const task of list) {
      // eslint-disable-next-line no-await-in-loop
      const r = await scheduleTriggeredNotificationForTask(task, dayKey);
      results.push({ dayKey, taskId: task?.id, ...r });
    }
  }

  return { ok: true, results };
}
