// VK7Days Service Worker for Background Notifications
const CACHE_NAME = "vk7days-v1";
const NOTIFICATION_TAG_PREFIX = "vk7_";

// Install event
self.addEventListener("install", (event) => {
  console.log("VK7Days SW: Installing...");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("VK7Days SW: Activating...");
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main app
self.addEventListener("message", (event) => {
  console.log("VK7Days SW: Received message", event.data);
  const { type, data } = event.data;

  if (type === "SCHEDULE_RESPONSE") {
    // Handle schedule data from client
    handleScheduleCheck(data);
  }
});

// Handle schedule check
async function handleScheduleCheck(scheduleData) {
  console.log("VK7Days SW: Handling schedule check", scheduleData);
  const { schedule, currentDay, currentTime } = scheduleData;

  if (!schedule || !schedule[currentDay]) {
    return;
  }

  const tasks = schedule[currentDay];
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Check if we've already fired notifications for this time
  const firedKey = `${dateKey}_${currentDay}_${currentTime}`;

  for (const task of tasks) {
    if (!task.enabled || task.time !== currentTime) {
      continue;
    }

    const taskFiredKey = `${firedKey}_${task.id}`;

    // Check if we already fired this notification
    const alreadyFired = await checkIfAlreadyFired(taskFiredKey);
    if (alreadyFired) {
      continue;
    }

    // Mark as fired
    await markAsFired(taskFiredKey);

    // Show notification
    try {
      await self.registration.showNotification("VK7Days Reminder", {
        body: `${task.title} (${task.time})`,
        tag: `vk7_${task.id}`,
        renotify: true,
        requireInteraction: true,
        icon: "/icons/vk7.png",
        badge: "/icons/vk7.png",
        data: {
          taskId: task.id,
          dayKey: currentDay,
          taskTitle: task.title,
          taskTime: task.time,
          hasCustomVoice: task.hasCustomVoice || false,
        },
        actions: [
          {
            action: "open",
            title: "Open App",
          },
          {
            action: "dismiss",
            title: "Dismiss",
          },
        ],
      });
      console.log("VK7Days SW: Notification shown for task", task.id);
    } catch (error) {
      console.error("VK7Days SW: Failed to show notification", error);
    }
  }
}

// Simple storage for fired notifications (using Cache API)
async function checkIfAlreadyFired(key) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(`/fired/${key}`);
    return !!response;
  } catch {
    return false;
  }
}

async function markAsFired(key) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(`/fired/${key}`, new Response("fired"));
  } catch {
    // Ignore errors
  }
}

// Handle background sync for alarm checking
self.addEventListener("sync", (event) => {
  console.log("VK7Days SW: Background sync triggered", event.tag);

  if (event.tag === "alarm-check") {
    event.waitUntil(checkAlarmsFromStorage());
  }
});

// Check alarms from stored data (for background sync)
async function checkAlarmsFromStorage() {
  try {
    // Open IndexedDB to get stored schedule
    const db = await openScheduleDB();
    const scheduleData = await getStoredSchedule(db);

    if (!scheduleData) {
      console.log("VK7Days SW: No stored schedule found");
      return;
    }

    const { schedule } = scheduleData;
    const now = new Date();
    const dayMap = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const currentDay = dayMap[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    console.log("VK7Days SW: Checking alarms for", currentDay, currentTime);

    await handleScheduleCheck({ schedule, currentDay, currentTime });
  } catch (error) {
    console.error("VK7Days SW: Error in background alarm check:", error);
  }
}

// Open IndexedDB for schedule storage
function openScheduleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("VK7DaysAlarms", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("schedule")) {
        db.createObjectStore("schedule", { keyPath: "id" });
      }
    };
  });
}

// Get stored schedule from IndexedDB
function getStoredSchedule(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["schedule"], "readonly");
    const store = transaction.objectStore("schedule");
    const request = store.get("current");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("VK7Days SW: Notification clicked", event.notification);

  const notification = event.notification;
  const data = notification.data || {};

  notification.close();

  // Extract task info from notification
  const taskId = data.taskId;
  const dayKey = data.dayKey;
  const taskTitle = data.taskTitle;
  const taskTime = data.taskTime;

  event.waitUntil(
    (async () => {
      // Try to find an existing window/tab
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If we have an existing window, focus it and send the alarm data
      if (windowClients.length > 0) {
        const client = windowClients[0];
        await client.focus();

        // Send alarm trigger message to the app
        client.postMessage({
          type: "TRIGGER_ALARM",
          taskId,
          dayKey,
          taskTitle,
          taskTime,
          hasCustomVoice: data.hasCustomVoice,
        });

        return;
      }

      // No existing window, open a new one with alarm parameters
      const url = new URL(self.registration.scope);
      url.searchParams.set("alarm", "true");
      url.searchParams.set("taskId", taskId);
      url.searchParams.set("dayKey", dayKey);
      url.searchParams.set("taskTitle", taskTitle);
      url.searchParams.set("taskTime", taskTime);
      if (data.hasCustomVoice) {
        url.searchParams.set("hasCustomVoice", "true");
      }

      await self.clients.openWindow(url.toString());
    })(),
  );
});

// Handle notification actions
self.addEventListener("notificationaction", (event) => {
  console.log("VK7Days SW: Notification action", event.action);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === "open") {
    // Open app and trigger alarm
    event.waitUntil(
      (async () => {
        const windowClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        if (windowClients.length > 0) {
          const client = windowClients[0];
          await client.focus();

          client.postMessage({
            type: "TRIGGER_ALARM",
            taskId: data.taskId,
            dayKey: data.dayKey,
            taskTitle: data.taskTitle,
            taskTime: data.taskTime,
            hasCustomVoice: data.hasCustomVoice,
          });

          return;
        }

        const url = new URL(self.registration.scope);
        url.searchParams.set("alarm", "true");
        url.searchParams.set("taskId", data.taskId);
        url.searchParams.set("dayKey", data.dayKey);
        url.searchParams.set("taskTitle", data.taskTitle);
        url.searchParams.set("taskTime", data.taskTime);
        if (data.hasCustomVoice) {
          url.searchParams.set("hasCustomVoice", "true");
        }

        await self.clients.openWindow(url.toString());
      })(),
    );
  } else if (action === "dismiss") {
    // Just dismiss the notification - already closed above
    console.log("VK7Days SW: Notification dismissed");
  }
});
