# VK7Days PWA Deployment Guide

## What's Implemented ✅

### Background Functionality

- **Service Worker**: Custom service worker handles background alarms
- **Default Ringtone**: Plays `/ringtone/Dholida.mp3` when app is closed
- **Notifications**: Shows notifications with "Stop" and "Open App" actions
- **Audio Repeat**: Both default ringtone and custom audio repeat every 2.5 seconds
- **Smart Audio Switching**:
  - App closed = Default ringtone plays
  - App open = Custom recorded audio plays (if available)
  - Notification clicked = Stops default ringtone, opens app, plays custom audio

### PWA Features

- **Offline Support**: App works offline with cached assets
- **Add to Home Screen**: Users can install the app
- **Background Persistence**: Alarms work even when app is closed

## Testing Steps

### 1. Deploy to Vercel

```bash
npm run build
# Deploy the dist folder to Vercel
```

### 2. Test Background Alarms

1. Open the deployed app
2. Click "Enable alerts" to grant notification permission
3. Add a task with a time 1-2 minutes in the future
4. Enable the task (toggle switch)
5. **Close the browser tab/app completely**
6. Wait for the alarm time
7. You should see:
   - Notification appears
   - Default ringtone plays and repeats every 2.5 seconds
8. Click the notification:
   - Default ringtone stops
   - App opens
   - Custom audio plays (if recorded)

### 3. Test Foreground Alarms

1. Keep app open
2. Set an alarm
3. When alarm triggers:
   - Notification appears
   - Custom audio plays (no default ringtone)
   - Alarm modal shows in app

## Browser Compatibility

### ✅ Supported

- Chrome/Edge (Android & Desktop)
- Firefox (with limitations)
- Safari (iOS 16.4+)

### ⚠️ Limitations

- **Audio Policy**: Some browsers require user interaction before playing audio
- **iOS Safari**: Background audio is limited
- **Firefox**: Service worker audio support varies

## Troubleshooting

### Default Ringtone Not Playing

- Check browser console for audio policy errors
- Ensure notification permission is granted
- Try interacting with notification first

### Notifications Not Showing

- Check notification permissions in browser settings
- Verify service worker is registered (check DevTools > Application > Service Workers)

### App Not Working Offline

- Check if service worker is caching files properly
- Verify `/ringtone/Dholida.mp3` is accessible

## Files Modified

- `vite.config.js` - PWA configuration
- `src/App.jsx` - Service worker integration
- `public/sw-custom.js` - Custom service worker for background alarms
- `public/ringtone/Dholida.mp3` - Default ringtone file

## Next Steps

1. Deploy to Vercel
2. Test on mobile devices
3. Test "Add to Home Screen" functionality
4. Verify background alarms work when app is completely closed
