package com.vk7days.taskscheduler;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import android.util.Log;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "VK7Days_AlarmReceiver";
    private static final String CHANNEL_ID = "vk7days_alarms";
    private static final int NOTIFICATION_ID = 12345;

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

            // Create notification channel
            createNotificationChannel(context);

            // Show full-screen notification with sound and vibration
            showAlarmNotification(context, taskTitle, taskTime, taskId, dayKey, hasCustomVoice);

            // Vibrate the device
            vibrateDevice(context);

        } catch (Exception e) {
            Log.e(TAG, "Error in alarm receiver", e);
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            // Check if channel already exists
            if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) {
                return;
            }

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "VK7Days Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            
            channel.setDescription("Task reminder alarms");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.RED);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);
            
            // Set default ringtone
            Uri defaultRingtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (defaultRingtone == null) {
                defaultRingtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            
            channel.setSound(defaultRingtone, audioAttributes);
            
            notificationManager.createNotificationChannel(channel);
            Log.d(TAG, "Notification channel created");
        }
    }

    private void showAlarmNotification(Context context, String taskTitle, String taskTime, 
                                     String taskId, String dayKey, boolean hasCustomVoice) {
        
        // Intent to open the app when notification is tapped
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openAppIntent.putExtra("taskId", taskId);
        openAppIntent.putExtra("taskTitle", taskTitle);
        openAppIntent.putExtra("taskTime", taskTime);
        openAppIntent.putExtra("dayKey", dayKey);
        openAppIntent.putExtra("hasCustomVoice", hasCustomVoice);
        openAppIntent.putExtra("fromAlarm", true);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 
            0, 
            openAppIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🔔 VK7Days Reminder")
            .setContentText(taskTitle + " (" + taskTime + ")" + (hasCustomVoice ? " 🎤" : ""))
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(taskTitle + "\n⏰ " + taskTime + (hasCustomVoice ? "\n🎤 Custom voice recording available" : "")))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setOngoing(false)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true) // Show as full-screen on lock screen
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        // Set default alarm sound
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        builder.setSound(alarmSound);

        // Set vibration pattern
        builder.setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000});

        // Show the notification
        NotificationManager notificationManager = 
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        notificationManager.notify(NOTIFICATION_ID, builder.build());
        
        Log.d(TAG, "Alarm notification shown for: " + taskTitle);
    }

    private void vibrateDevice(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                // Vibrate in pattern: wait 0ms, vibrate 1000ms, wait 500ms, vibrate 1000ms
                long[] pattern = {0, 1000, 500, 1000, 500, 1000};
                vibrator.vibrate(pattern, -1); // -1 means don't repeat
                Log.d(TAG, "Device vibrated");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error vibrating device", e);
        }
    }
}