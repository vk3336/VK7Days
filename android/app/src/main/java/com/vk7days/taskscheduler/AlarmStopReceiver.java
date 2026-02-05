package com.vk7days.taskscheduler;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class AlarmStopReceiver extends BroadcastReceiver {
    private static final String TAG = "VK7Days_AlarmStop";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);
        
        if ("STOP_ALARM".equals(action) || "DISMISS_ALARM".equals(action)) {
            // Stop the alarm sound service
            AlarmSoundService.stopAlarmService(context);
            Log.d(TAG, "Alarm dismissed by user");
        }
    }
}