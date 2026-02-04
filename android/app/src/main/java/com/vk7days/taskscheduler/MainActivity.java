package com.vk7days.taskscheduler;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "VK7Days_MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int BATTERY_OPTIMIZATION_REQUEST_CODE = 1002;
    private static final int EXACT_ALARM_PERMISSION_REQUEST_CODE = 1003;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Keep screen on for alarms
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        
        // Create notification channel for Android 8.0+
        createNotificationChannel();
        
        // Request all necessary permissions
        requestAllPermissions();
        
        // Handle intent from alarm notification
        handleAlarmIntent(getIntent());
        
        // Register the alarm scheduling plugin
        registerPlugin(AlarmSchedulerPlugin.class);
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmIntent(intent);
    }
    
    private void handleAlarmIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("fromAlarm", false)) {
            Log.d(TAG, "App opened from alarm notification");
            
            String taskId = intent.getStringExtra("taskId");
            String taskTitle = intent.getStringExtra("taskTitle");
            String taskTime = intent.getStringExtra("taskTime");
            String dayKey = intent.getStringExtra("dayKey");
            boolean hasCustomVoice = intent.getBooleanExtra("hasCustomVoice", false);
            
            // Send data to JavaScript
            if (getBridge() != null) {
                getBridge().eval(
                    "window.handleAlarmFromBackground && window.handleAlarmFromBackground(" +
                    "'" + taskId + "', '" + taskTitle + "', '" + taskTime + "', '" + dayKey + "', " + hasCustomVoice +
                    ");", null
                );
            }
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "vk7days_reminders",
                "VK7Days Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Task reminders and alarms");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.BLUE);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
    
    private void requestAllPermissions() {
        // Request notification permissions for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST_CODE);
            }
        }
        
        // Request exact alarm permission for Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (!alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, EXACT_ALARM_PERMISSION_REQUEST_CODE);
            }
        }
        
        // Request to ignore battery optimizations
        requestBatteryOptimizationExemption();
    }
    
    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            String packageName = getPackageName();
            
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                Log.d(TAG, "Requesting battery optimization exemption");
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
                startActivityForResult(intent, BATTERY_OPTIMIZATION_REQUEST_CODE);
            }
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Notification permission granted");
            } else {
                Log.w(TAG, "Notification permission denied");
            }
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == BATTERY_OPTIMIZATION_REQUEST_CODE) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager.isIgnoringBatteryOptimizations(getPackageName())) {
                Log.d(TAG, "Battery optimization exemption granted");
            } else {
                Log.w(TAG, "Battery optimization exemption denied");
            }
        } else if (requestCode == EXACT_ALARM_PERMISSION_REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                if (alarmManager.canScheduleExactAlarms()) {
                    Log.d(TAG, "Exact alarm permission granted");
                } else {
                    Log.w(TAG, "Exact alarm permission denied");
                }
            }
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // App is active - notifications will work normally
    }
    
    // Plugin for scheduling background alarms
    @CapacitorPlugin(name = "AlarmScheduler")
    public static class AlarmSchedulerPlugin extends Plugin {
        
        @PluginMethod
        public void scheduleAlarm(PluginCall call) {
            String taskId = call.getString("taskId");
            String taskTitle = call.getString("taskTitle");
            String taskTime = call.getString("taskTime");
            String dayKey = call.getString("dayKey");
            boolean hasCustomVoice = call.getBoolean("hasCustomVoice", false);
            long triggerTime = call.getLong("triggerTime");
            
            if (taskId == null || triggerTime == 0) {
                call.reject("Missing required parameters");
                return;
            }
            
            try {
                Context context = getContext();
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                
                // Create intent for the alarm receiver
                Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                alarmIntent.putExtra("taskId", taskId);
                alarmIntent.putExtra("taskTitle", taskTitle);
                alarmIntent.putExtra("taskTime", taskTime);
                alarmIntent.putExtra("dayKey", dayKey);
                alarmIntent.putExtra("hasCustomVoice", hasCustomVoice);
                
                // Create unique request code from task ID
                int requestCode = Math.abs(taskId.hashCode());
                
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                
                // Schedule exact alarm
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    );
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    );
                }
                
                Log.d(TAG, "Scheduled alarm for task: " + taskId + " at " + triggerTime);
                call.resolve();
                
            } catch (Exception e) {
                Log.e(TAG, "Error scheduling alarm", e);
                call.reject("Failed to schedule alarm: " + e.getMessage());
            }
        }
        
        @PluginMethod
        public void cancelAlarm(PluginCall call) {
            String taskId = call.getString("taskId");
            
            if (taskId == null) {
                call.reject("Missing taskId parameter");
                return;
            }
            
            try {
                Context context = getContext();
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                
                Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                int requestCode = Math.abs(taskId.hashCode());
                
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
                
                Log.d(TAG, "Cancelled alarm for task: " + taskId);
                call.resolve();
                
            } catch (Exception e) {
                Log.e(TAG, "Error cancelling alarm", e);
                call.reject("Failed to cancel alarm: " + e.getMessage());
            }
        }
        
        @PluginMethod
        public void checkPermissions(PluginCall call) {
            Context context = getContext();
            boolean hasNotificationPermission = true;
            boolean hasExactAlarmPermission = true;
            boolean isBatteryOptimized = true;
            
            // Check notification permission
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                hasNotificationPermission = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            }
            
            // Check exact alarm permission
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                hasExactAlarmPermission = alarmManager.canScheduleExactAlarms();
            }
            
            // Check battery optimization
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                isBatteryOptimized = !powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
            }
            
            call.resolve(new com.getcapacitor.JSObject()
                .put("hasNotificationPermission", hasNotificationPermission)
                .put("hasExactAlarmPermission", hasExactAlarmPermission)
                .put("isBatteryOptimized", isBatteryOptimized));
        }
    }
}