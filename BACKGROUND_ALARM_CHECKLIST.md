# Background Alarm Testing Checklist

## ✅ What's Fixed:

1. **Service Worker**: Completely rewritten with better alarm checking
2. **Storage**: Uses localStorage (more reliable than IndexedDB in SW)
3. **Frequent Checks**: Alarms checked every 30 seconds (instead of 60)
4. **Better Logging**: Console logs to help debug issues
5. **Audio Volume**: Set to maximum (1.0)
6. **Service Worker Lifecycle**: Proper install/activate handling

## 🧪 Testing Steps:

### 1. Deploy and Basic Test:

```bash
git add .
git commit -m "Fix background alarms with improved service worker"
git push origin main
```

### 2. Test Background Functionality:

1. **Open your deployed app**
2. **Click "Enable alerts"** - should show success message
3. **Add a task** with time 2 minutes from now
4. **Enable the task** (toggle switch on)
5. **COMPLETELY CLOSE the browser tab/app**
6. **Wait for alarm time**
7. **Expected**: Notification + default ringtone playing every 2.5 seconds

### 3. Test Notification Click:

1. **Click the notification**
2. **Expected**:
   - Default ringtone stops
   - App opens
   - Custom audio plays (if recorded)

### 4. Debug if Not Working:

1. **Open `/test-sw.html`** on your deployed site
2. **Click "Check Service Worker"** - should show 1 active SW
3. **Click "Test Alarm"** - sets alarm 1 minute from now
4. **Click "Test Ringtone"** - should play Dholida.mp3
5. **Check browser console** for error messages

## 🔍 Common Issues & Solutions:

### Issue: No notification appears

- **Check**: Notification permission granted?
- **Fix**: Click lock icon → Allow notifications → Refresh

### Issue: Notification appears but no sound

- **Check**: Browser audio policy (needs user interaction)
- **Fix**: Click notification first, then test again

### Issue: Service worker not working

- **Check**: Open DevTools → Application → Service Workers
- **Fix**: Unregister old SWs, refresh page

### Issue: Alarms not triggering

- **Check**: Console logs in service worker
- **Fix**: Verify time format and day matching

## 📱 Mobile Testing:

### Android Chrome:

1. **Add to Home Screen**
2. **Open from home screen** (not browser)
3. **Set alarm, close app completely**
4. **Should work perfectly**

### iPhone Safari:

1. **Add to Home Screen**
2. **Background audio may be limited**
3. **Notifications should still work**

## 🚨 If Still Not Working:

The service worker is now much more robust. If it still doesn't work:

1. **Check browser console** for errors
2. **Try the test page** at `/test-sw.html`
3. **Verify the ringtone file** loads at `/ringtone/Dholida.mp3`
4. **Test on different browsers/devices**

The background functionality should now work reliably! 🎉
