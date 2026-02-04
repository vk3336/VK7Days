import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

class AndroidNotificationService {
  constructor() {
    this.isAndroid = Capacitor.getPlatform() === "android";
    this.scheduledNotifications = new Map();
  }

  async requestPermissions() {
    if (!this.isAndroid) {
      return { granted: false, reason: "not_android" };
    }

    try {
      // Request notification permissions
      const permission = await LocalNotifications.requestPermissions();

      if (permission.display === "granted") {
        console.log("✅ Notification permissions granted");
        return { granted: true };
      } else {
        console.log("❌ Notification permissions denied");
        return { granted: false, reason: "permission_denied" };
      }
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return { granted: false, reason: "error", error };
    }
  }

  async checkPermissions() {
    if (!this.isAndroid) {
      return { granted: false };
    }

    try {
      const permission = await LocalNotifications.checkPermissions();
      return { granted: permission.display === "granted" };
    } catch (error) {
      console.error("Error checking notification permissions:", error);
      return { granted: false };
    }
  }

  async scheduleNotification(task, dayKey) {
    if (!this.isAndroid) {
      return { success: false, reason: "not_android" };
    }

    try {
      const { granted } = await this.checkPermissions();
      if (!granted) {
        return { success: false, reason: "no_permission" };
      }

      // Calculate next occurrence
      const nextTime = this.getNextOccurrence(dayKey, task.time);
      if (!nextTime) {
        return { success: false, reason: "invalid_time" };
      }

      const notificationId =
        parseInt(task.id.replace(/[^0-9]/g, "")) ||
        Math.floor(Math.random() * 10000);

      // Cancel existing notification for this task
      await this.cancelNotification(task.id);

      // Always use default sound for background notifications
      // Custom audio will play when user opens the app
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "VK7Days Reminder",
            body: `${task.title} (${task.time})${task.hasCustomVoice ? " 🎤" : ""}`,
            id: notificationId,
            schedule: { at: nextTime },
            sound: "default", // Always use default sound for background
            actionTypeId: "TASK_REMINDER",
            extra: {
              taskId: task.id,
              dayKey: dayKey,
              hasCustomVoice: task.hasCustomVoice,
              taskTitle: task.title,
              taskTime: task.time,
            },
            // Make notification open the app when tapped
            ongoing: false,
            autoCancel: true,
          },
        ],
      });

      // Store the mapping
      this.scheduledNotifications.set(task.id, notificationId);

      console.log(
        `✅ Scheduled notification for task ${task.id} at ${nextTime}`,
      );
      return { success: true, scheduledAt: nextTime, notificationId };
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return { success: false, reason: "schedule_error", error };
    }
  }

  async cancelNotification(taskId) {
    if (!this.isAndroid) {
      return;
    }

    try {
      const notificationId = this.scheduledNotifications.get(taskId);
      if (notificationId) {
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
        });
        this.scheduledNotifications.delete(taskId);
        console.log(`✅ Cancelled notification for task ${taskId}`);
      }
    } catch (error) {
      console.error("Error cancelling notification:", error);
    }
  }

  async scheduleAllTasks(schedule) {
    if (!this.isAndroid) {
      return { success: false, reason: "not_android" };
    }

    const results = [];

    for (const [dayKey, tasks] of Object.entries(schedule)) {
      for (const task of tasks) {
        if (task.enabled) {
          const result = await this.scheduleNotification(task, dayKey);
          results.push({ taskId: task.id, dayKey, ...result });
        }
      }
    }

    return { success: true, results };
  }

  async clearAllNotifications() {
    if (!this.isAndroid) {
      return;
    }

    try {
      // Get all pending notifications
      const pending = await LocalNotifications.getPending();

      if (pending.notifications.length > 0) {
        // Cancel all notifications
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }

      this.scheduledNotifications.clear();
      console.log("✅ Cleared all notifications");
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }

  getNextOccurrence(dayKey, timeStr) {
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

    // Set target time
    target.setHours(hours, minutes, 0, 0);

    // Calculate days until target day
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;

    if (daysUntil < 0) {
      daysUntil += 7; // Next week
    } else if (daysUntil === 0 && target <= now) {
      daysUntil = 7; // Same day but time passed, schedule for next week
    }

    target.setDate(now.getDate() + daysUntil);

    return target;
  }

  // Listen for notification actions
  setupNotificationListeners() {
    if (!this.isAndroid) {
      return;
    }

    // When notification is tapped (opens the app)
    LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (notification) => {
        console.log("Notification tapped - opening app:", notification);
        this.handleNotificationTap(notification);
      },
    );

    // When notification is received (background)
    LocalNotifications.addListener(
      "localNotificationReceived",
      (notification) => {
        console.log("Notification received in background:", notification);
      },
    );
  }

  // Handle when user taps notification to open app
  async handleNotificationTap(notification) {
    const { taskId, hasCustomVoice, dayKey, taskTitle, taskTime } =
      notification.notification.extra || {};

    if (!taskId) return;

    console.log(`📱 App opened from notification for task: ${taskId}`);

    // Create task object for the alarm modal
    const task = {
      id: taskId,
      title: taskTitle || "Task Reminder",
      time: taskTime || "",
      hasCustomVoice: hasCustomVoice || false,
    };

    // Trigger the alarm modal in the app
    if (window.showAlarmFromNotification) {
      window.showAlarmFromNotification(task, dayKey);
    }

    // Play custom audio if available
    if (hasCustomVoice && taskId) {
      setTimeout(() => {
        this.playCustomAudio(taskId);
      }, 500); // Small delay to ensure app is fully loaded
    }
  }

  async playCustomAudio(taskId) {
    try {
      console.log(`🎤 Playing custom audio for task: ${taskId}`);

      // Try to get the recording from storage
      if (window.audioStorage) {
        const recording = await window.audioStorage.getRecording(taskId);
        if (recording.success && recording.audioUrl) {
          console.log(
            `✅ Found custom recording, playing: ${recording.audioUrl}`,
          );

          // Use the existing audio player
          if (window.audioPlayer) {
            await window.audioPlayer.startLoop(recording.audioUrl, 2500);
          }
          return;
        }
      }

      // Fallback: try direct URL
      const audioUrl = `/recordings/${taskId}.webm`;
      console.log(`🔄 Trying fallback audio URL: ${audioUrl}`);

      if (window.audioPlayer) {
        await window.audioPlayer.startLoop(audioUrl, 2500);
      }
    } catch (error) {
      console.error("❌ Error playing custom audio:", error);

      // Show a message to user if custom audio fails
      setTimeout(() => {
        if (window.alert) {
          alert(
            `🎤 Custom voice recording for this task couldn't be played.\n\nError: ${error.message || "Unknown error"}`,
          );
        }
      }, 1000);
    }
  }
}

export const androidNotifications = new AndroidNotificationService();
