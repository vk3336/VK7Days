import { Capacitor } from "@capacitor/core";

class BackgroundAlarmService {
  constructor() {
    this.isAndroid = Capacitor.getPlatform() === "android";
    this.scheduledAlarms = new Map();
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Handle alarms when app is opened from background notification
    window.handleAlarmFromBackground = (
      taskId,
      taskTitle,
      taskTime,
      dayKey,
      hasCustomVoice,
    ) => {
      console.log(`📱 App opened from background alarm: ${taskId}`);

      const task = {
        id: taskId,
        title: taskTitle,
        time: taskTime,
        hasCustomVoice: hasCustomVoice,
      };

      // Show the alarm modal
      if (window.showAlarmFromNotification) {
        window.showAlarmFromNotification(task, dayKey);
      }

      // Play custom audio if available
      if (hasCustomVoice) {
        setTimeout(() => {
          this.playCustomAudio(taskId);
        }, 1000);
      }
    };
  }

  async checkPermissions() {
    if (!this.isAndroid) {
      return {
        granted: false,
        reason: "not_android",
        hasNotificationPermission: false,
        hasExactAlarmPermission: false,
        isBatteryOptimized: true,
      };
    }

    try {
      const result = await Capacitor.Plugins.AlarmScheduler.checkPermissions();

      const allGranted =
        result.hasNotificationPermission &&
        result.hasExactAlarmPermission &&
        !result.isBatteryOptimized;

      return {
        granted: allGranted,
        ...result,
      };
    } catch (error) {
      console.error("Error checking permissions:", error);
      return {
        granted: false,
        reason: "error",
        error,
        hasNotificationPermission: false,
        hasExactAlarmPermission: false,
        isBatteryOptimized: true,
      };
    }
  }

  async requestPermissions() {
    if (!this.isAndroid) {
      return { granted: false, reason: "not_android" };
    }

    try {
      const permissions = await this.checkPermissions();

      let message = "🔔 Background alarms are now enabled!\n\n";

      if (permissions.hasNotificationPermission) {
        message += "✅ Notifications: Allowed\n";
      } else {
        message += "❌ Notifications: Please allow in settings\n";
      }

      if (permissions.hasExactAlarmPermission) {
        message += "✅ Exact alarms: Allowed\n";
      } else {
        message += "❌ Exact alarms: Please allow in settings\n";
      }

      if (!permissions.isBatteryOptimized) {
        message += "✅ Battery optimization: Disabled\n";
      } else {
        message +=
          "⚠️ Battery optimization: Please disable for reliable alarms\n";
      }

      message +=
        "\n🎯 Your tasks will now trigger even when the app is closed!";

      return {
        granted: permissions.granted,
        message,
        permissions,
      };
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return { granted: false, reason: "error", error };
    }
  }

  async scheduleAlarm(task, dayKey) {
    if (!this.isAndroid) {
      return { success: false, reason: "not_android" };
    }

    try {
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        return {
          success: false,
          reason: "no_permission",
          permissions,
        };
      }

      // Calculate next occurrence
      const nextTime = this.getNextOccurrence(dayKey, task.time);
      if (!nextTime) {
        return { success: false, reason: "invalid_time" };
      }

      // Cancel existing alarm for this task
      await this.cancelAlarm(task.id);

      // Schedule the background alarm using native AlarmManager
      await Capacitor.Plugins.AlarmScheduler.scheduleAlarm({
        taskId: task.id,
        taskTitle: task.title,
        taskTime: task.time,
        dayKey: dayKey,
        hasCustomVoice: task.hasCustomVoice || false,
        triggerTime: nextTime.getTime(),
      });

      // Store the mapping
      this.scheduledAlarms.set(task.id, {
        dayKey,
        scheduledAt: nextTime,
        task: task,
      });

      console.log(
        `✅ Scheduled background alarm for task ${task.id} at ${nextTime}`,
      );
      return { success: true, scheduledAt: nextTime };
    } catch (error) {
      console.error("Error scheduling background alarm:", error);
      return { success: false, reason: "schedule_error", error };
    }
  }

  async cancelAlarm(taskId) {
    if (!this.isAndroid) {
      return;
    }

    try {
      await Capacitor.Plugins.AlarmScheduler.cancelAlarm({
        taskId: taskId,
      });

      this.scheduledAlarms.delete(taskId);
      console.log(`✅ Cancelled background alarm for task ${taskId}`);
    } catch (error) {
      console.error("Error cancelling background alarm:", error);
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
          const result = await this.scheduleAlarm(task, dayKey);
          results.push({ taskId: task.id, dayKey, ...result });
        }
      }
    }

    return { success: true, results };
  }

  async clearAllAlarms() {
    if (!this.isAndroid) {
      return;
    }

    try {
      // Cancel all stored alarms
      for (const taskId of this.scheduledAlarms.keys()) {
        await this.cancelAlarm(taskId);
      }

      this.scheduledAlarms.clear();
      console.log("✅ Cleared all background alarms");
    } catch (error) {
      console.error("Error clearing background alarms:", error);
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
    }
  }

  getScheduledAlarms() {
    return Array.from(this.scheduledAlarms.entries()).map(([taskId, data]) => ({
      taskId,
      ...data,
    }));
  }
}

export const backgroundAlarms = new BackgroundAlarmService();
