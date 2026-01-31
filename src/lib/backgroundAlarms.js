// Background alarm system using multiple approaches for better reliability

/**
 * Schedule background alarms using the best available method
 */
export async function scheduleBackgroundAlarms(schedule) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return { ok: false, reason: "no_permission" };
  }

  const results = [];

  // Method 1: Try Notification Triggers API (Chrome/Edge with experimental flags)
  if (canUseNotificationTriggers()) {
    const triggerResults = await scheduleWithTriggers(schedule);
    results.push({ method: "triggers", ...triggerResults });
  }

  // Method 2: Use service worker with periodic background sync (if available)
  if (
    "serviceWorker" in navigator &&
    "sync" in window.ServiceWorkerRegistration.prototype
  ) {
    const syncResults = await scheduleWithBackgroundSync(schedule);
    results.push({ method: "background_sync", ...syncResults });
  }

  // Method 3: Schedule immediate notifications for tasks happening soon
  const immediateResults = await scheduleImmediateNotifications(schedule);
  results.push({ method: "immediate", ...immediateResults });

  return { ok: true, results };
}

/**
 * Check if Notification Triggers API is available
 */
function canUseNotificationTriggers() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "TimestampTrigger" in window
  );
}

/**
 * Schedule notifications using Notification Triggers API
 */
async function scheduleWithTriggers(schedule) {
  if (!canUseNotificationTriggers()) {
    return { ok: false, reason: "not_supported" };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const scheduled = [];

    for (const [dayKey, tasks] of Object.entries(schedule)) {
      for (const task of tasks) {
        if (!task.enabled) continue;

        const nextTime = getNextOccurrence(dayKey, task.time);
        if (!nextTime) continue;

        const trigger = new window.TimestampTrigger(nextTime);

        await reg.showNotification("VK7Days Reminder", {
          body: `${task.title} (${task.time})`,
          tag: `vk7_${task.id}`,
          renotify: true,
          requireInteraction: true,
          icon: "/icons/vk7.png",
          badge: "/icons/vk7.png",
          showTrigger: trigger,
          data: {
            taskId: task.id,
            dayKey: dayKey,
            taskTitle: task.title,
            taskTime: task.time,
            hasCustomVoice: task.hasCustomVoice || false,
          },
          actions: [
            { action: "open", title: "Open App" },
            { action: "dismiss", title: "Dismiss" },
          ],
        });

        scheduled.push({ taskId: task.id, dayKey, scheduledFor: nextTime });
      }
    }

    return { ok: true, scheduled };
  } catch (error) {
    console.error("Failed to schedule with triggers:", error);
    return { ok: false, reason: "schedule_failed", error: error.message };
  }
}

/**
 * Schedule using background sync (limited browser support)
 */
async function scheduleWithBackgroundSync(schedule) {
  try {
    const reg = await navigator.serviceWorker.ready;

    // Store schedule data for background sync
    await storeScheduleForBackgroundSync(schedule);

    // Register background sync
    await reg.sync.register("alarm-check");

    return { ok: true, method: "background_sync" };
  } catch (error) {
    console.error("Failed to schedule background sync:", error);
    return { ok: false, reason: "sync_failed", error: error.message };
  }
}

/**
 * Schedule immediate notifications for tasks happening in the next few hours
 */
async function scheduleImmediateNotifications(schedule) {
  const now = new Date();
  const scheduled = [];

  // Look ahead 4 hours for tasks to schedule immediately
  const lookAheadMs = 4 * 60 * 60 * 1000;

  for (const [dayKey, tasks] of Object.entries(schedule)) {
    for (const task of tasks) {
      if (!task.enabled) continue;

      const nextTime = getNextOccurrence(dayKey, task.time);
      if (!nextTime || nextTime - now.getTime() > lookAheadMs) continue;

      // Schedule immediate notification
      const delay = nextTime - now.getTime();
      if (delay > 0) {
        setTimeout(async () => {
          try {
            if ("serviceWorker" in navigator) {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification("VK7Days Reminder", {
                body: `${task.title} (${task.time})`,
                tag: `vk7_${task.id}`,
                renotify: true,
                requireInteraction: true,
                icon: "/icons/vk7.png",
                badge: "/icons/vk7.png",
                data: {
                  taskId: task.id,
                  dayKey: dayKey,
                  taskTitle: task.title,
                  taskTime: task.time,
                  hasCustomVoice: task.hasCustomVoice || false,
                },
                actions: [
                  { action: "open", title: "Open App" },
                  { action: "dismiss", title: "Dismiss" },
                ],
              });
            } else {
              new Notification("VK7Days Reminder", {
                body: `${task.title} (${task.time})`,
                requireInteraction: true,
                icon: "/icons/vk7.png",
              });
            }
          } catch (error) {
            console.error("Failed to show scheduled notification:", error);
          }
        }, delay);

        scheduled.push({ taskId: task.id, dayKey, delay });
      }
    }
  }

  return { ok: true, scheduled };
}

/**
 * Get next occurrence timestamp for a day/time combination
 */
function getNextOccurrence(dayKey, timeStr) {
  const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = dayMap[dayKey.toLowerCase()];
  if (targetDay === undefined) return null;

  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const now = new Date();
  const target = new Date();

  // Set to target time
  target.setHours(hours, minutes, 0, 0);

  // Calculate days until target day
  const currentDay = now.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;

  // If it's today but time has passed, schedule for next week
  if (daysUntil === 0 && target.getTime() <= now.getTime()) {
    daysUntil = 7;
  }

  target.setDate(target.getDate() + daysUntil);
  return target.getTime();
}

/**
 * Store schedule data for background sync
 */
async function storeScheduleForBackgroundSync(schedule) {
  try {
    // Store in IndexedDB for service worker access
    const request = indexedDB.open("VK7DaysAlarms", 1);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["schedule"], "readwrite");
        const store = transaction.objectStore("schedule");

        store.put({ id: "current", schedule, updatedAt: Date.now() });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("schedule")) {
          db.createObjectStore("schedule", { keyPath: "id" });
        }
      };
    });
  } catch (error) {
    console.error("Failed to store schedule for background sync:", error);
  }
}
