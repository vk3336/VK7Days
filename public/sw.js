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

  notification.close();

  if (action === "open") {
    // Same logic as notification click
    const data = notification.data || {};

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
  }
  // 'dismiss' action just closes the notification (already done above)
});
