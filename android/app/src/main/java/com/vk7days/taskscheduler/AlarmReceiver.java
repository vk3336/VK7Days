package com.vk7days.taskscheduler;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "VK7Days_AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm received!");
        
        // Wake up the device
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, 
            "VK7Days::AlarmWakeLock"
        );
        wakeLock.acquire(30000); // Hold for 30 seconds max

        try {
            // Get task details from intent
            String taskTitle = intent.getStringExtra("taskTitle");
            String taskTime = intent.getStringExtra("taskTime");
            String taskId = intent.getStringExtra("taskId");
            String dayKey = intent.getStringExtra("dayKey");
            boolean hasCustomVoice = intent.getBooleanExtra("hasCustomVoice", false);

            if (taskTitle == null) taskTitle = "Task Reminder";
            if (taskTime == null) taskTime = "";

            Log.d(TAG, "Task: " + taskTitle + " at " + taskTime);

            // Start the alarm sound service (plays ringtone continuously)
            AlarmSoundService.startAlarmService(context, taskId, taskTitle, taskTime, dayKey, hasCustomVoice);

        } catch (Exception e) {
            Log.e(TAG, "Error in alarm receiver", e);
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
}