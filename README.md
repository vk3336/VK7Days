# VK7Days - Personal Voice Task Scheduler

A React-based Progressive Web App (PWA) for scheduling daily tasks with personalized voice reminders and comprehensive analytics tracking.

## Features

- **Daily Task Management**: Organize tasks by day of the week
- **Personal Voice Reminders**: Record your own voice saying each task title for truly personalized alerts
- **Smart Notifications**: Browser notifications with background scheduling support
- **Progressive Web App**: Install on mobile/desktop for offline access
- **Google Analytics Integration**: Comprehensive event tracking for user interactions
- **Search & Filter**: Find tasks quickly across your schedule
- **Responsive Design**: Works seamlessly on all devices

## Personal Voice Recording System

- **Record Your Own Voice**: Each task can have a custom voice recording of you saying the task title
- **Personalized Alarms**: When the alarm triggers, your own recorded voice plays on repeat until you press **Stop**
- **Easy Recording**: Simply click the microphone button and say your task title
- **Preview & Edit**: Listen to your recordings and re-record if needed
- **Visual Indicators**: Tasks with custom voice recordings show a 🎤 icon

### How to Use Voice Recording

1. **Create a Task**: Enter your task title and time
2. **Record Your Voice**: Click "🎤 Record [your task]" and say the task title clearly
3. **Preview**: Click "▶ Preview" to hear your recording
4. **Save**: Your recording is automatically saved with the task
5. **Alarm Time**: When the time comes, your voice will play repeatedly until stopped

## Google Analytics Setup

This app includes comprehensive Google Analytics 4 tracking for all user interactions.

### 1. Get Your GA4 Measurement ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property or use an existing one
3. Copy your Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
2. Edit `.env` and add your Measurement ID:
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

### 3. Tracked Events

The app automatically tracks these user interactions:

**App Lifecycle**

- App start/initialization
- PWA installation

**Task Management**

- Task creation, editing, deletion
- Task enable/disable toggles
- Day navigation changes

**Voice & Audio**

- Voice recording start/stop/cancel
- Voice recording preview plays
- Custom voice alarm triggers and interactions

**Notifications**

- Permission requests and results
- Notification enable/disable

**Search & Navigation**

- Task search queries
- Modal open/close events

**Data Management**

- Day clearing actions
- Full data reset

**Error Tracking**

- JavaScript errors and exceptions

## Development Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vk7days

# Install dependencies
npm install

# Set up environment variables
copy .env.example .env
# Edit .env with your Google Analytics Measurement ID

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **PWA** - Progressive Web App capabilities
- **Google Analytics 4** - User behavior tracking
- **MediaRecorder API** - Voice recording functionality
- **IndexedDB** - Persistent audio storage
- **Notification API** - Browser notifications
- **Service Workers** - Background functionality

## Browser Compatibility

- **Chrome/Edge**: Full feature support including voice recording and background notifications
- **Firefox**: Core features supported, voice recording available, limited background notification support
- **Safari**: Core features supported, voice recording may require user permission, notification permissions required
- **Mobile browsers**: PWA installation and core features supported, voice recording works on modern mobile browsers

## Privacy & Analytics

This app uses Google Analytics to track user interactions for improving the user experience. All tracking is anonymous and no personal data is collected. Users can disable analytics by not providing a GA Measurement ID in the environment configuration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
