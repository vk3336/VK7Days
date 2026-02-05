package com.vk7days.taskscheduler;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class AlarmSoundService extends Service {
    private static final String TAG = "VK7Days_AlarmSound";
    private static final String CHANNEL_ID = "vk7days_alarm_sound";
    private static final int NOTIFICATION_ID = 12346;
    private static final int FOREGROUND_NOTIFICATION_ID = 12347;
    
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private boolean isPlaying = false;
    
    // Task details for notification
    private String taskTitle;
    private String taskTime;
    private String taskId;
    private String dayKey;
    private boolean hasCustomVoice;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "AlarmSoundService created");
        
        // Create notification channel
        createNotificationChannel();
        
        // Acquire wake lock to keep device awake
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "VK7Days::AlarmSoundWakeLock"
        );
        wakeLock.acquire(5 * 60 * 1000); // Hold for 5 minutes max
        
        // Get vibrator service
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "AlarmSoundService started");
        
        if (intent != null) {
            taskTitle = intent.getStringExtra("taskTitle");
            taskTime = intent.getStringExtra("taskTime");
            taskId = intent.getStringExtra("taskId");
            dayKey = intent.getStringExtra("dayKey");
            hasCustomVoice = intent.getBooleanExtra("hasCustomVoice", false);
            
            if (taskTitle == null) taskTitle = "Task Reminder";
            if (taskTime == null) taskTime = "";
        }
        
        // Start foreground service
        startForeground(FOREGROUND_NOTIFICATION_ID, createForegroundNotification());
        
        // Show the main alarm notification
        showAlarmNotification();
        
        // Start playing alarm sound
        startAlarmSound();
        
        // Start vibration
        startVibration();
        
        return START_NOT_STICKY; // Don't restart if killed
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            // Channel for foreground service
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "VK7Days Alarm Sound Service",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Background service for alarm sounds");
            serviceChannel.setSound(null, null); // No sound for service notification
            notificationManager.createNotificationChannel(serviceChannel);
            
            // Channel for alarm notifications (high importance with sound)
            NotificationChannel alarmChannel = new NotificationChannel(
                "vk7days_alarms",
                "VK7Days Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("Task reminder alarms");
            alarmChannel.enableVibration(true);
            alarmChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            alarmChannel.enableLights(true);
            alarmChannel.setLightColor(android.graphics.Color.RED);
            alarmChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            alarmChannel.setBypassDnd(true);
            
            // Set default alarm ringtone for the channel
            Uri defaultRingtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (defaultRingtone == null) {
                defaultRingtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            
            alarmChannel.setSound(defaultRingtone, audioAttributes);
            notificationManager.createNotificationChannel(alarmChannel);
        }
    }

    private Notification createForegroundNotification() {
        // Intent to stop the service
        Intent stopIntent = new Intent(this, AlarmStopReceiver.class);
        stopIntent.setAction("STOP_ALARM");
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("VK7Days Alarm Playing")
            .setContentText("Tap to stop alarm")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
            .build();
    }

    private void showAlarmNotification() {
        // Intent to open the app
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openAppIntent.putExtra("taskId", taskId);
        openAppIntent.putExtra("taskTitle", taskTitle);
        openAppIntent.putExtra("taskTime", taskTime);
        openAppIntent.putExtra("dayKey", dayKey);
        openAppIntent.putExtra("hasCustomVoice", hasCustomVoice);
        openAppIntent.putExtra("fromAlarm", true);

        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Intent to dismiss the alarm
        Intent dismissIntent = new Intent(this, AlarmStopReceiver.class);
        dismissIntent.setAction("DISMISS_ALARM");
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            this, 1, dismissIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the main alarm notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "vk7days_alarms")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🔔 VK7Days Reminder")
            .setContentText(taskTitle + " (" + taskTime + ")" + (hasCustomVoice ? " 🎤" : ""))
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(taskTitle + "\n⏰ " + taskTime + (hasCustomVoice ? "\n🎤 Custom voice recording available" : "")))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(false) // Don't auto-cancel
            .setOngoing(true) // Keep notification visible
            .setContentIntent(openPendingIntent)
            .setFullScreenIntent(openPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "Open", openPendingIntent);

        // Don't set sound here - we're playing it manually
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        notificationManager.notify(NOTIFICATION_ID, builder.build());
        Log.d(TAG, "Alarm notification shown");
    }

    private void startAlarmSound() {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }

            // Get default alarm ringtone
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            if (alarmUri != null) {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(this, alarmUri);
                
                // Set audio attributes for alarm
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    mediaPlayer.setAudioAttributes(audioAttributes);
                } else {
                    mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                
                // Set to loop continuously
                mediaPlayer.setLooping(true);
                
                // Set volume to maximum
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0);
                
                mediaPlayer.prepare();
                mediaPlayer.start();
                isPlaying = true;
                
                Log.d(TAG, "Alarm sound started playing in loop");
            } else {
                Log.w(TAG, "No alarm ringtone available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting alarm sound", e);
        }
    }

    private void startVibration() {
        try {
            if (vibrator != null && vibrator.hasVibrator()) {
                // Vibrate continuously: 1 second on, 0.5 seconds off, repeat
                long[] pattern = {0, 1000, 500};
                vibrator.vibrate(pattern, 0); // 0 means repeat indefinitely
                Log.d(TAG, "Vibration started");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration", e);
        }
    }

    public void stopAlarm() {
        Log.d(TAG, "Stopping alarm sound and vibration");
        
        // Stop media player
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
                isPlaying = false;
                Log.d(TAG, "Media player stopped and released");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping media player", e);
            }
        }
        
        // Stop vibration
        if (vibrator != null) {
            try {
                vibrator.cancel();
                Log.d(TAG, "Vibration stopped");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping vibration", e);
            }
        }
        
        // Cancel notifications
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(NOTIFICATION_ID);
        notificationManager.cancel(FOREGROUND_NOTIFICATION_ID);
        
        // Stop foreground service
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "AlarmSoundService destroyed");
        
        stopAlarm();
        
        // Release wake lock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    public static void startAlarmService(Context context, String taskId, String taskTitle, 
                                       String taskTime, String dayKey, boolean hasCustomVoice) {
        Intent serviceIntent = new Intent(context, AlarmSoundService.class);
        serviceIntent.putExtra("taskId", taskId);
        serviceIntent.putExtra("taskTitle", taskTitle);
        serviceIntent.putExtra("taskTime", taskTime);
        serviceIntent.putExtra("dayKey", dayKey);
        serviceIntent.putExtra("hasCustomVoice", hasCustomVoice);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }

    public static void stopAlarmService(Context context) {
        Intent serviceIntent = new Intent(context, AlarmSoundService.class);
        context.stopService(serviceIntent);
    }
}