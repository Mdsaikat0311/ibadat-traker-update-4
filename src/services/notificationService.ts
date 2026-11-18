import { ReminderSetting } from '../types/ibadat';
import { getRandomHadithFromAllCollections, FullHadithNotification } from '../data/hadithBank';
import { repository } from '../data/repository';
import { auth, getTopUsersByMetric } from './firebase';

// Cordova plugin typing definitions
declare global {
  interface Window {
    device?: {
      platform?: string;
      version?: string;
    };
    cordova?: {
      plugins?: {
        notification?: {
          local?: {
            hasPermission: (callback: (granted: boolean) => void) => void;
            requestPermission: (callback: (granted: boolean) => void) => void;
            schedule: (options: any | any[]) => void;
            cancel: (id: any | any[], callback?: () => void) => void;
            clear: (id: any | any[], callback?: () => void) => void;
            getAll: (callback: (notifications: any[]) => void) => void;
            isPresent: (id: number, callback: (present: boolean) => void) => void;
            update: (options: any) => void;
            createChannel?: (options: any) => void;
            setDefaults?: (options: any) => void;
            on?: (event: string, callback: (...args: any[]) => void) => void;
          };
        };
        backgroundMode?: {
          enable: () => void;
          disable: () => void;
          isEnabled: () => boolean;
          isActive: () => boolean;
          setDefaults: (options: Record<string, any>) => void;
          overrideBackButton: () => void;
          excludeFromTaskList?: () => void;
          disableBatteryOptimizations?: () => void;
          disableWebViewOptimizations?: () => void;
        };
        permissions?: {
          POST_NOTIFICATIONS?: string;
          checkPermission: (permission: string, success: (status: any) => void, error?: (err: any) => void) => void;
          requestPermission: (permission: string, success: (status: any) => void, error?: (err: any) => void) => void;
        };
      };
    };
  }
}

// Memory of what was triggered today to prevent duplicate triggers in JS ticker
const triggeredKeysToday = new Set<string>();
let lastDayKey = "";
let lastHadithTimestamp = Date.now();
let lastGeneralTimestamp = Date.now();
let isDeviceReady = false;
const readyListeners: Array<() => void> = [];

// Convert activity key and repeat index to a unique integer ID for Cordova Local Notifications
function hashKeyToNumber(key: string, index: number): number {
  let hash = 0;
  const str = `${key}_${index}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 500000) * 10 + (index % 10) + 1000;
}

// Initialize Cordova deviceready listener
if (typeof document !== 'undefined') {
  document.addEventListener('deviceready', () => {
    isDeviceReady = true;
    console.log('[Cordova] deviceready event triggered successfully!');
    NotificationService.initCordova();
    readyListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('deviceready listener error:', e);
      }
    });
  }, false);
}

export interface FardSalahReminder {
  id: number;
  waqt: string;
  hour: number;
  minute: number;
  timeFormatted: string;
  title: string;
  text: string;
}

export const FARD_SALAH_SCHEDULE: FardSalahReminder[] = [
  {
    id: 60001,
    waqt: 'ফজর',
    hour: 6,
    minute: 0,
    timeFormatted: 'সকাল ৬:০০ AM',
    title: '🕌 ফজরের নামাজ আদায় করেছেন কি?',
    text: 'আপনি কি ফজরের নামাজ আদায় করেছেন? যদি করে থাকেন তাহলে মাশাআল্লাহ, আলহামদুলিল্লাহ। আর যদি না করে থাকেন তাহলে অবশ্যই নামাজটি আদায় করে নিবেন। আর নামাজ মিস হয়ে গেলে অবশ্যই কাজা আদায় করে নিবেন। কারণ পাঁচ ওয়াক্ত সালাত আপনার উপর ফরজ। নামাজ পড়তেই হবে।'
  },
  {
    id: 60002,
    waqt: 'যোহর',
    hour: 14,
    minute: 0,
    timeFormatted: 'দুপুর ২:০০ PM',
    title: '🕌 যোহরের নামাজ আদায় করেছেন কি?',
    text: 'আপনি কি যোহরের নামাজ আদায় করেছেন? যদি করে থাকেন তাহলে মাশাআল্লাহ, আলহামদুলিল্লাহ। আর যদি না করে থাকেন তাহলে অবশ্যই নামাজটি আদায় করে নিবেন। আর নামাজ মিস হয়ে গেলে অবশ্যই কাজা আদায় করে নিবেন। কারণ পাঁচ ওয়াক্ত সালাত আপনার উপর ফরজ। নামাজ পড়তেই হবে।'
  },
  {
    id: 60003,
    waqt: 'আসর',
    hour: 17,
    minute: 0,
    timeFormatted: 'বিকেল ৫:০০ PM',
    title: '🕌 আসরের নামাজ আদায় করেছেন কি?',
    text: 'আপনি কি আসরের নামাজ আদায় করেছেন? যদি করে থাকেন তাহলে মাশাআল্লাহ, আলহামদুলিল্লাহ। আর যদি না করে থাকেন তাহলে অবশ্যই নামাজটি আদায় করে নিবেন। আর নামাজ মিস হয়ে গেলে অবশ্যই কাজা আদায় করে নিবেন। কারণ পাঁচ ওয়াক্ত সালাত আপনার উপর ফরজ। নামাজ পড়তেই হবে।'
  },
  {
    id: 60004,
    waqt: 'মাগরিব',
    hour: 18,
    minute: 30,
    timeFormatted: 'সন্ধ্যা ৬:৩০ PM',
    title: '🕌 মাগরিবের নামাজ আদায় করেছেন কি?',
    text: 'আপনি কি মাগরিবের নামাজ আদায় করেছেন? যদি করে থাকেন তাহলে মাশাআল্লাহ, আলহামদুলিল্লাহ। আর যদি না করে থাকেন তাহলে অবশ্যই নামাজটি আদায় করে নিবেন। আর নামাজ মিস হয়ে গেলে অবশ্যই কাজা আদায় করে নিবেন। কারণ পাঁচ ওয়াক্ত সালাত আপনার উপর ফরজ। নামাজ পড়তেই হবে।'
  },
  {
    id: 60005,
    waqt: 'এশা',
    hour: 21,
    minute: 0,
    timeFormatted: 'রাত ৯:০০ PM',
    title: '🕌 এশার নামাজ আদায় করেছেন কি?',
    text: 'আপনি কি এশার নামাজ আদায় করেছেন? যদি করে থাকেন তাহলে মাশাআল্লাহ, আলহামদুলিল্লাহ। আর যদি না করে থাকেন তাহলে অবশ্যই নামাজটি আদায় করে নিবেন। আর নামাজ মিস হয়ে গেলে অবশ্যই কাজা আদায় করে নিবেন। কারণ পাঁচ ওয়াক্ত সালাত আপনার উপর ফরজ। নামাজ পড়তেই হবে।'
  }
];

export class NotificationService {
  /**
   * Register a listener for when Cordova deviceready fires
   */
  static onDeviceReady(listener: () => void): () => void {
    if (isDeviceReady) {
      listener();
    }
    readyListeners.push(listener);
    return () => {
      const idx = readyListeners.indexOf(listener);
      if (idx !== -1) readyListeners.splice(idx, 1);
    };
  }

  /**
   * Check if Cordova Local Notification plugin is available
   */
  static isCordovaAvailable(): boolean {
    return Boolean(
      typeof window !== 'undefined' &&
      window.cordova?.plugins?.notification?.local
    );
  }

  /**
   * Check if Cordova is in environment
   */
  static isCordovaEnvironment(): boolean {
    return Boolean(typeof window !== 'undefined' && window.cordova);
  }

  /**
   * Check if Web Notification API is available in browser
   */
  static isWebNotificationAvailable(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Ensures all Android notification channels are created with custom sound 'reminder_sound2'
   */
  static ensureChannels(): void {
    if (typeof window === 'undefined' || !window.cordova?.plugins?.notification?.local?.createChannel) return;
    const local = window.cordova.plugins.notification.local;
    if (!local || typeof local.createChannel !== 'function') return;
    const soundUri = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : undefined;
    const createChan = local.createChannel.bind(local);

    try {
      // 1. Hadith channel with reminder_sound2
      createChan({
        id: 'hadith_channel_v5',
        name: 'হাদিস রিমাইন্ডার',
        description: 'প্রতি ১ ঘণ্টার নির্বাচিত হাদিস ও বাণী',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: soundUri
      });

      // 2. Instant notification channel with reminder_sound2
      createChan({
        id: 'ibadat_instant_channel_v3',
        name: 'ইবাদত রিমাইন্ডার',
        description: 'আমল ও ওয়াক্ত নোটিফিকেশন',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: soundUri
      });

      // 3. Reminders channel with reminder_sound2
      createChan({
        id: 'ibadat_reminders_channel_v3',
        name: 'ইবাদত ওয়াক্ত রিমাইন্ডার',
        description: 'ওয়াক্ত ও আমলের সময়সূচীর নোটিফিকেশন',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: soundUri
      });

      // 4. Nightly Leaderboard channel with reminder_sound2
      createChan({
        id: 'night_leaderboard_v2',
        name: 'Nightly Leaderboard',
        description: 'রাতের লিডারবোর্ড ও আমল রিমাইন্ডার',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: soundUri
      });

      // 5. Fard Salah channel with reminder_sound2
      createChan({
        id: 'fard_salah_channel_v1',
        name: 'ফরজ সালাত রিমাইন্ডার',
        description: 'পাঁচ ওয়াক্ত ফরজ সালাত আদায়ের নোটিফিকেশন',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: soundUri
      });
    } catch (e) {
      console.warn('[Cordova] Error creating notification channels:', e);
    }
  }

  /**
   * Initializes Cordova plugins (Background Mode, Channels, Permissions)
   */
  static initCordova(): void {
    if (typeof window === 'undefined' || !window.cordova) return;

    // 1. Configure Background Mode if installed
    try {
      const bg = window.cordova.plugins?.backgroundMode;
      if (bg) {
        bg.setDefaults({
          title: 'ইবাদত ট্র্যাকার চলছে',
          text: 'ওয়াক্ত ও আমলের রিমাইন্ডার ব্যাকগ্রাউন্ডে সক্রিয় রয়েছে',
          icon: 'icon',
          color: '0D9488',
          silent: true
        });
        bg.enable();
        bg.overrideBackButton();
        console.log('[Cordova] background-mode enabled successfully');
      }
    } catch (e) {
      console.warn('[Cordova] background-mode init failed:', e);
    }

    // 2. Request Android 13+ Notification Permissions (POST_NOTIFICATIONS)
    try {
      const local = window.cordova.plugins?.notification?.local;
      if (local) {
        local.hasPermission((granted) => {
          if (!granted) {
            local.requestPermission((res) => {
              console.log('[Cordova] local-notification permission response:', res);
            });
          }
        });

        // 3. Register all notification channels with custom sound 'reminder_sound2'
        this.ensureChannels();

        // 4. Register the 5 daily Fard Salah notifications
        this.scheduleFardSalahNotifications();
      }

      const permissions = window.cordova.plugins?.permissions;
      if (permissions && typeof permissions.POST_NOTIFICATIONS === 'string') {
        const postNotif = permissions.POST_NOTIFICATIONS;
        permissions.checkPermission(postNotif, (status: any) => {
          if (!status?.hasPermission) {
            permissions.requestPermission(postNotif, (s: any) => {
              console.log('[Cordova] POST_NOTIFICATIONS granted:', s);
            });
          }
        });
      }
    } catch (e) {
      console.warn('[Cordova] permission/channel check error:', e);
    }

    // Schedule dynamic nightly notifications upon Cordova readiness
    this.scheduleDynamicNightlyNotifications();
  }

  /**
   * Request notification permission from Cordova or Browser
   */
  static async requestPermission(): Promise<boolean> {
    if (this.isCordovaAvailable()) {
      return new Promise<boolean>((resolve) => {
        try {
          window.cordova!.plugins!.notification!.local!.requestPermission((granted) => {
            resolve(Boolean(granted));
          });
        } catch {
          resolve(false);
        }
      });
    }

    if (this.isWebNotificationAvailable()) {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get current permission state
   */
  static getPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (this.isCordovaAvailable()) {
      return 'granted';
    }
    if (this.isWebNotificationAvailable()) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  /**
   * Diagnostic report for troubleshooting outside/background notifications
   */
  static getDiagnostics(): {
    isCordova: boolean;
    isDeviceReady: boolean;
    hasLocalNotification: boolean;
    hasBackgroundMode: boolean;
    permission: string;
  } {
    return {
      isCordova: Boolean(typeof window !== 'undefined' && window.cordova),
      isDeviceReady,
      hasLocalNotification: Boolean(typeof window !== 'undefined' && window.cordova?.plugins?.notification?.local),
      hasBackgroundMode: Boolean(typeof window !== 'undefined' && window.cordova?.plugins?.backgroundMode),
      permission: this.getPermissionState()
    };
  }

  /**
   * Play a pleasant melodic Islamic chime using Web Audio API
   */
  static playChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Triple chime: C5 -> E5 -> G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);

        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.65);
      });
    } catch (e) {
      console.warn("Chime audio failed", e);
    }
  }

  private static inAppListeners: Array<(title: string, body: string) => void> = [];

  /**
   * ইন-অ্যাপ নোটিফিকেশন লিসেনার রেজিস্টার করে
   */
  static addInAppListener(listener: (title: string, body: string) => void): () => void {
    this.inAppListeners.push(listener);
    return () => {
      this.inAppListeners = this.inAppListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Send an immediate notification (Web, Cordova, and Audio chime)
   */
  static sendNotification(title: string, body: string): void {
    // 1. Play audio chime
    this.playChime();

    // 2. Notify all registered in-app listeners
    this.inAppListeners.forEach((listener) => {
      try {
        listener(title, body);
      } catch (err) {
        console.warn("InApp listener error:", err);
      }
    });

    // 3. Try Cordova Local Notification (shows on system tray / heads-up)
    if (this.isCordovaAvailable()) {
      try {
        this.ensureChannels();
        const soundUri = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;
        window.cordova!.plugins!.notification!.local!.schedule({
          id: Math.floor(Math.random() * 800000) + 100000,
          title,
          text: body,
          foreground: true,
          wakeup: true,
          vibrate: true,
          sound: soundUri,
          priority: 2,
          importance: 4,
          channel: 'ibadat_instant_channel_v3',
          channelName: 'ইবাদত রিমাইন্ডার',
          channelDescription: 'আমল ও ওয়াক্ত নোটিফিকেশন',
          lockscreenVisibility: 1
        });
      } catch (err) {
        console.warn("Cordova immediate notification failed", err);
      }
    }

    // 4. Try HTML5 Web Notification
    if (this.isWebNotificationAvailable() && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/app-icon.jpg',
          badge: '/app-icon.jpg',
          tag: 'ibadat_instant_' + Date.now()
        });
      } catch (err) {
        console.warn("HTML5 notification failed", err);
      }
    }
  }

  /**
   * Schedule native Cordova local notifications for an activity reminder.
   * This is registered directly in Android's AlarmManager so that it triggers
   * even when the user is OUTSIDE the app, locked, or after reboot!
   */
  static scheduleCordovaReminders(setting: ReminderSetting): void {
    if (!this.isCordovaAvailable()) {
      console.log(`[Cordova] Cannot schedule ${setting.name}: Cordova plugin not detected.`);
      return;
    }

    try {
      const [hourStr, minuteStr] = setting.start.split(':');
      const baseHour = parseInt(hourStr, 10) || 6;
      const baseMin = parseInt(minuteStr, 10) || 0;
      const notifications: any[] = [];

      for (let i = 0; i < setting.count; i++) {
        const triggerTime = new Date();
        triggerTime.setHours(baseHour);
        triggerTime.setMinutes(baseMin + i * setting.interval);
        triggerTime.setSeconds(0);
        triggerTime.setMilliseconds(0);

        // If time already passed today, schedule for tomorrow
        if (triggerTime.getTime() <= Date.now()) {
          triggerTime.setDate(triggerTime.getDate() + 1);
        }

        const notifId = hashKeyToNumber(setting.key, i);
        const soundSetting = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;

        notifications.push({
          id: notifId,
          title: `⏰ ${setting.name} এর রিমাইন্ডার`,
          text: `এখন ${setting.name}-এর ওয়াক্ত/আমল করার সময় হয়েছে (${i + 1}/${setting.count} বার)। আমলটি সম্পূর্ণ করুন।`,
          trigger: {
            at: triggerTime,
            every: 'day' // Android repeats daily at this exact time!
          },
          foreground: true,
          wakeup: true,
          vibrate: true,
          sound: soundSetting,
          priority: 2, // High priority
          importance: 4, // Android 8+ IMPORTANCE_HIGH (pops up banner)
          channel: 'ibadat_reminders_channel_v3',
          channelName: 'ইবাদত ওয়াক্ত রিমাইন্ডার',
          channelDescription: 'ওয়াক্ত ও আমলের সময়সূচীর নোটিফিকেশন',
          lockscreenVisibility: 1
        });
      }

      window.cordova!.plugins!.notification!.local!.schedule(notifications);
      console.log(`[Cordova] Successfully scheduled ${notifications.length} alarms for ${setting.name}`);
    } catch (e) {
      console.warn("Failed scheduling Cordova notifications", e);
    }
  }

  /**
   * Test a delayed notification (e.g. 5 seconds) so user can minimize
   * the app and test outside-the-app notification on their phone.
   */
  static scheduleDelayedOutsideTest(delaySeconds = 5, onScheduled?: () => void): void {
    const triggerDate = new Date(Date.now() + delaySeconds * 1000);
    const title = '🔔 ইবাদত ট্র্যাকার টেস্ট নোটিফিকেশন';
    const text = 'আলহামদুলিল্লাহ! বাহিরের (Background & Lockscreen) নোটিফিকেশন সফলভাবে কাজ করছে।';

    if (this.isCordovaAvailable()) {
      try {
        this.ensureChannels();
        const soundSetting = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;
        window.cordova!.plugins!.notification!.local!.schedule({
          id: 999991,
          title,
          text,
          trigger: { at: triggerDate },
          foreground: true,
          wakeup: true,
          vibrate: true,
          sound: soundSetting,
          priority: 2,
          importance: 4,
          channel: 'ibadat_instant_channel_v3',
          channelName: 'ইবাদত টেস্ট চ্যানেল',
          channelDescription: 'টেস্টিং নোটিফিকেশন',
          lockscreenVisibility: 1
        });
      } catch (err) {
        console.warn("Cordova delayed test failed", err);
      }
    } else if (this.isWebNotificationAvailable() && Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification(title, {
          body: text,
          icon: './app-icon.jpg',
          badge: './app-icon.jpg'
        });
        this.playChime();
      }, delaySeconds * 1000);
    } else {
      setTimeout(() => {
        this.playChime();
      }, delaySeconds * 1000);
    }

    if (onScheduled) onScheduled();
  }

  /**
   * Cancel native Cordova notifications for an activity reminder
   */
  static cancelCordovaReminders(key: string, maxCount = 10): void {
    if (!this.isCordovaAvailable()) return;

    try {
      const ids: number[] = [];
      for (let i = 0; i < maxCount; i++) {
        ids.push(hashKeyToNumber(key, i));
      }
      window.cordova!.plugins!.notification!.local!.cancel(ids);
      console.log(`[Cordova] Cancelled alarms for ${key}`);
    } catch (e) {
      console.warn("Failed canceling Cordova notifications", e);
    }
  }

  /**
   * Reschedule all active reminders into Cordova (e.g. on app launch or deviceready)
   */
  static syncAllCordovaReminders(reminders: Record<string, ReminderSetting>): void {
    if (!this.isCordovaAvailable()) return;
    Object.values(reminders).forEach((setting) => {
      this.scheduleCordovaReminders(setting);
    });
  }

  /**
   * Schedule background Hadith notifications directly into Android AlarmManager / Cordova.
   * Sends the actual Hadith text directly in the notification body so users can expand
   * and read it right from their notification shade without having to open the app!
   */
  static scheduleCordovaHadithReminders(intervalMinutes = 60, count = 100): void {
    if (!this.isCordovaAvailable()) {
      console.log('[Cordova] Cannot schedule hadith notifications: Cordova plugin not detected.');
      return;
    }

    // Cancel old schedules first
    this.cancelCordovaHadithReminders();

    try {
      this.ensureChannels();
      const notifications: any[] = [];
      const now = Date.now();
      const soundSetting = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;

      for (let i = 1; i <= count; i++) {
        const triggerTime = new Date(now + i * intervalMinutes * 60 * 1000);
        const hadith = getRandomHadithFromAllCollections();

        notifications.push({
          id: 80000 + i,
          title: hadith.title,
          text: hadith.body, // সরাসরি সম্পূর্ণ হাদিস নোটিফিকেশনে থাকবে এবং স্ক্রল করে টান দিলে বড় হয়ে পুরোটা পড়া যাবে
          summary: hadith.reference,
          trigger: { at: triggerTime },
          foreground: true,
          wakeup: true,
          vibrate: true,
          sound: soundSetting,
          priority: 2,
          importance: 4,
          channel: 'hadith_channel_v5',
          channelName: 'হাদিস রিমাইন্ডার',
          channelDescription: 'প্রতি ১ ঘণ্টার নির্বাচিত হাদিস ও বাণী',
          lockscreenVisibility: 1
        });
      }

      window.cordova!.plugins!.notification!.local!.schedule(notifications);
      console.log(`[Cordova] Successfully scheduled ${notifications.length} hourly hadith notifications from all collections with reminder_sound2.`);
    } catch (e) {
      console.warn("Failed scheduling Cordova hadith notifications", e);
    }
  }

  /**
   * Test a random Hadith notification immediately from all available collections.
   * Sends the full Hadith so the user can pull down the notification shade and read it right away without opening the app.
   */
  static testRandomHadithNotification(): FullHadithNotification {
    const hadith = getRandomHadithFromAllCollections();
    this.sendNotification(hadith.title, hadith.body);
    return hadith;
  }

  /**
   * Cancel all scheduled Cordova background hadith notifications
   */
  static cancelCordovaHadithReminders(): void {
    if (!this.isCordovaAvailable()) return;
    try {
      const ids: number[] = [];
      for (let i = 1; i <= 250; i++) {
        ids.push(80000 + i);
      }
      window.cordova!.plugins!.notification!.local!.cancel(ids);
      console.log('[Cordova] Cancelled all background hadith notifications.');
    } catch (e) {
      console.warn("Failed canceling Cordova hadith notifications", e);
    }
  }

  /**
   * Schedule the 5 daily Fard Salah native Cordova local notifications
   * Fajr (6:00 AM), Dhuhr (2:00 PM), Asr (5:00 PM), Maghrib (6:30 PM), Isha (9:00 PM)
   * Triggers once daily at the exact minute with reminder_sound2.
   */
  static scheduleFardSalahNotifications(): void {
    if (!this.isCordovaAvailable()) return;

    try {
      this.ensureChannels();
      const local = window.cordova!.plugins!.notification!.local!;
      const soundSetting = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;

      FARD_SALAH_SCHEDULE.forEach((item) => {
        local.schedule({
          id: item.id,
          title: item.title,
          text: item.text,
          trigger: { every: { hour: item.hour, minute: item.minute } },
          foreground: true,
          wakeup: true,
          vibrate: true,
          sound: soundSetting,
          priority: 2,
          importance: 4,
          channel: 'fard_salah_channel_v1',
          channelName: 'ফরজ সালাত রিমাইন্ডার',
          channelDescription: 'পাঁচ ওয়াক্ত ফরজ সালাত আদায়ের নোটিফিকেশন',
          lockscreenVisibility: 1
        });
      });
      console.log('[Cordova] Successfully scheduled all 5 daily Fard Salah reminders with reminder_sound2.');
    } catch (e) {
      console.warn('Failed scheduling Fard Salah notifications', e);
    }
  }

  /**
   * Test a specific Fard Salah notification immediately
   */
  static testFardSalahNotification(id: number): void {
    const item = FARD_SALAH_SCHEDULE.find((x) => x.id === id) || FARD_SALAH_SCHEDULE[0];
    this.sendNotification(item.title, item.text);
  }

  /**
   * Periodic scheduler that runs inside the app (every 15-30 seconds).
   * Note: Only triggers in-app alert when app is foreground, and also sends sound/notification.
   */
  static checkTick(
    reminders: Record<string, ReminderSetting>,
    autoHadithEnabled: boolean,
    generalReminder: { enabled: boolean; interval: number },
    onInAppNotification: (title: string, message: string) => void
  ): void {
    const now = new Date();
    const todayKey = repository.getTodayKey();

    // Reset daily trigger cache on new day
    if (lastDayKey !== todayKey) {
      triggeredKeysToday.clear();
      lastDayKey = todayKey;
    }

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const notify = (title: string, msg: string) => {
      this.sendNotification(title, msg);
      if (this.inAppListeners.length === 0) {
        onInAppNotification(title, msg);
      }
    };

    // 1. Check Specific Activity Reminders
    Object.values(reminders).forEach((r) => {
      if (!r.start) return;
      const [hStr, mStr] = r.start.split(':');
      const startHour = parseInt(hStr, 10) || 0;
      const startMin = parseInt(mStr, 10) || 0;

      for (let i = 0; i < r.count; i++) {
        const totalMinutes = startHour * 60 + startMin + i * r.interval;
        const targetHour = Math.floor(totalMinutes / 60) % 24;
        const targetMin = totalMinutes % 60;

        if (currentHour === targetHour && currentMin === targetMin) {
          const triggerKey = `${todayKey}_${r.key}_${i}`;
          if (!triggeredKeysToday.has(triggerKey)) {
            triggeredKeysToday.add(triggerKey);

            const title = `⏰ ${r.name} এর রিমাইন্ডার`;
            const msg = `এখন ${r.name}-এর ওয়াক্ত/আমল করার সময় হয়েছে (${i + 1}/${r.count} বার)। আমলটি সম্পূর্ণ করুন।`;

            notify(title, msg);
          }
        }
      }
    });

    // 2. Check Auto Hadith (every 60 mins / 1 hour)
    if (autoHadithEnabled) {
      const elapsedMinutes = (Date.now() - lastHadithTimestamp) / (1000 * 60);
      if (elapsedMinutes >= 60) {
        lastHadithTimestamp = Date.now();
        const hadith = getRandomHadithFromAllCollections();
        notify(hadith.title, hadith.body);
      }
    }

    // 3. Check General Tauba & Zikir Reminder
    if (generalReminder.enabled && generalReminder.interval > 0) {
      const elapsedMinutes = (Date.now() - lastGeneralTimestamp) / (1000 * 60);
      if (elapsedMinutes >= generalReminder.interval) {
        lastGeneralTimestamp = Date.now();
        const title = `📿 তাওবাহ ও যিকিরের রিমাইন্ডার`;
        const msg = `আসতাগফিরুল্লাহ, সুবহানাল্লাহ, আলহামদুলিল্লাহ, লা ইলাহা ইল্লাল্লাহ পাঠ করে অন্তরকে সতেজ করুন।`;
        notify(title, msg);
      }
    }

    // 4. Check Dynamic Leaderboard Reminders (9:50 AM, 11:50 AM, 8:30 PM, 9:00 PM, 10:00 PM, 11:00 PM)
    const nightlySchedule = [
      { hour: 9, minute: 50, index: 1 },  // 9:50 AM (১ম)
      { hour: 11, minute: 50, index: 2 }, // 11:50 AM (২য়)
      { hour: 20, minute: 30, index: 3 }, // 8:30 PM (৩য়)
      { hour: 21, minute: 0, index: 4 },  // 9:00 PM (৪র্থ)
      { hour: 22, minute: 0, index: 5 },  // 10:00 PM (৫ম)
      { hour: 23, minute: 0, index: 6 }   // 11:00 PM (৬ষ্ঠ)
    ];

    const matchedSlot = nightlySchedule.find((s) => s.hour === currentHour && s.minute === currentMin);
    if (matchedSlot) {
      const notifIndex = matchedSlot.index;
      const notifKey = `${todayKey}_nightly_${notifIndex}`;
      if (!triggeredKeysToday.has(notifKey)) {
        triggeredKeysToday.add(notifKey);
        this.getNightlyMessageForIndex(notifIndex).then((msg) => {
          if (msg) {
            notify(msg.title, msg.body);
          }

          // পরের ৪টি নোটিফিকেশনের (৩-৬) ঠিক পরপরই যদি কারো পয়েন্ট ০ হয়, তবে ২য় নোটিফিকেশন হিসেবে শূন্য পয়েন্ট সতর্কতা দেওয়া হবে
          const currentPts = repository.calculatePoints(todayKey);
          if (notifIndex >= 3 && notifIndex <= 6 && currentPts === 0) {
            const zeroKey = `${todayKey}_nightly_zero_${notifIndex}`;
            if (!triggeredKeysToday.has(zeroKey)) {
              triggeredKeysToday.add(zeroKey);
              setTimeout(() => {
                this.getNightlyMessageForIndex(7).then((zeroMsg) => {
                  if (zeroMsg) {
                    notify(zeroMsg.title, zeroMsg.body);
                  }
                });
              }, 4000);
            }
          }
        });
      }
    }

    // 5. Check Fard Salah in-app reminder
    FARD_SALAH_SCHEDULE.forEach((item) => {
      if (currentHour === item.hour && currentMin === item.minute) {
        const triggerKey = `${todayKey}_fard_salah_${item.id}`;
        if (!triggeredKeysToday.has(triggerKey)) {
          triggeredKeysToday.add(triggerKey);
          notify(item.title, item.text);
        }
      }
    });
  }

  /**
   * ৬টি নোটিফিকেশনের মেসেজ ও লিডারবোর্ড ডাটা এককভাবে তৈরি করে
   */
  private static async buildNightlyNotificationContext(): Promise<{
    myRealTimePoints: number;
    messagesByIndex: Record<number, { title: string; body: string }>;
  }> {
    const todayKey = repository.getTodayKey();
    const myRealTimePoints = repository.calculatePoints(todayKey);
    const myPointsToday = myRealTimePoints;
    const stats = repository.getAppStats(todayKey);
    const myPointsYesterday = stats.yesterdayPoints || 0;
    const score7Days = stats.totalPoints7Days || 0;
    const score30Days = stats.totalPoints30Days || 0;
    const highScore30 = stats.highScore30Days || 0;

    let myRankToday = 0;
    let isTodayBest = false;
    let myRankYesterdayNum = 0;
    let isYesterdayBest = false;
    let topName = 'সেরা আমলকারী';
    let topPoints = 0;

    const currentUid = auth.currentUser ? auth.currentUser.uid : null;
    const myDisplayName = auth.currentUser?.displayName || repository.getUserName() || 'ব্যবহারকারী';

    const computeRankings = (
      users: Array<{ id: string; name: string; points: number; isCurrentUser?: boolean }>,
      myLivePoints: number
    ) => {
      const merged = users.map((u) => ({ ...u }));
      const existingIdx = merged.findIndex((u) =>
        currentUid ? u.id === currentUid : Boolean(u.isCurrentUser)
      );

      if (existingIdx !== -1) {
        merged[existingIdx].points = Math.max(merged[existingIdx].points || 0, myLivePoints);
        if (myLivePoints >= 0) {
          merged[existingIdx].points = myLivePoints;
        }
      } else {
        merged.push({
          id: currentUid || 'current_user',
          name: myDisplayName,
          points: myLivePoints,
          isCurrentUser: true
        });
      }

      const activeUsers = merged.filter((u) => (Number(u.points) || 0) > 0);
      activeUsers.sort((a, b) => b.points - a.points);

      let currentRank = 1;
      const rankedActive = activeUsers.map((u, idx) => {
        if (idx > 0 && u.points < activeUsers[idx - 1].points) {
          currentRank++;
        }
        return { ...u, rank: currentRank };
      });

      const myEntry = rankedActive.find((u) =>
        currentUid ? u.id === currentUid : Boolean(u.isCurrentUser)
      );

      const topUser = rankedActive.length > 0 ? rankedActive[0] : null;
      // পয়েন্ট ০ হলে র্যাঙ্ক অবশ্যই ০ (কোনো র্যাঙ্ক নেই)
      const myRank = myLivePoints <= 0 ? 0 : myEntry ? myEntry.rank : rankedActive.length + 1;
      const isBest = Boolean(myLivePoints > 0 && myEntry && myEntry.rank === 1);

      return {
        myRank,
        isBest,
        topName: topUser ? topUser.name : myDisplayName,
        topPoints: topUser ? topUser.points : 0
      };
    };

    let cloudTodayUsers: Array<{ id: string; name: string; points: number; isCurrentUser?: boolean }> = [];
    let cloudYesterdayUsers: Array<{ id: string; name: string; points: number; isCurrentUser?: boolean }> = [];

    try {
      const [todayUsers, yesterdayUsers] = await Promise.all([
        getTopUsersByMetric('todayPoints', 0),
        getTopUsersByMetric('yesterdayPoints', 0)
      ]);
      if (todayUsers && todayUsers.length > 0) cloudTodayUsers = todayUsers;
      if (yesterdayUsers && yesterdayUsers.length > 0) cloudYesterdayUsers = yesterdayUsers;
    } catch (err) {
      console.warn('Failed to load cloud leaderboard for nightly notifications:', err);
    }

    const todaySource =
      cloudTodayUsers.length > 0 ? cloudTodayUsers : repository.getLeaderboard('todayPoints');
    const todayRes = computeRankings(todaySource, myPointsToday);
    myRankToday = todayRes.myRank;
    isTodayBest = todayRes.isBest;
    topName = todayRes.topName;
    topPoints = todayRes.topPoints;

    const yesterdaySource =
      cloudYesterdayUsers.length > 0
        ? cloudYesterdayUsers
        : repository.getLeaderboard('yesterdayPoints');
    const yestRes = computeRankings(yesterdaySource, myPointsYesterday);
    myRankYesterdayNum = yestRes.myRank;
    isYesterdayBest = yestRes.isBest;

    const myRankYesterday = `#${myRankYesterdayNum}`;
    const pointsNeeded = topPoints > myPointsToday ? (topPoints - myPointsToday) + 1 : 1;
    const leaderHeader =
      topPoints > 0
        ? `🎉 প্রথম স্থানে আছেন ${topName} (${topPoints})`
        : `🎉 প্রথম স্থানে ওঠার সুযোগ! আজ এখনো কেউ আমল শুরু করেনি`;

    const messagesByIndex: Record<number, { title: string; body: string }> = {};

    // --- ১. ১ম নোটিফিকেশন (সকাল ৯:৫০ AM) ---
    if (myRankYesterdayNum === 0) {
      messagesByIndex[1] = {
        title: `⚠️ গতকাল আপনার কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `গতকাল ইবাদতে কোনো র্যাঙ্ক নেই (অসম্পূর্ণ আমল, র্যাঙ্ক #0)। গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} | ৩০ দিনের হাইস্কোর: ${highScore30}। আজ নিয়মিত আমল করে নিজের ইবাদতের উন্নতি করুন ও আখিরাত সুন্দর করুন।`
      };
    } else if (isYesterdayBest) {
      messagesByIndex[1] = {
        title: `🏆মাশাআল্লাহ! আপনিই গতকালকের সেরা! 👑${myRankYesterday}`,
        body: `গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} |৩০ দিনের হাইস্কোর: ${highScore30}। নিজের ইবাদতের উন্নতি করে আখিরাত সুন্দর করুন।`
      };
    } else {
      messagesByIndex[1] = {
        title: `গতকাল লিডারবোর্ডে আপনি ছিলেন ${myRankYesterday}`,
        body: `গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} |৩০ দিনের হাইস্কোর: ${highScore30}। নিজের ইবাদতের উন্নতি করে আখিরাত সুন্দর করুন।`
      };
    }

    // --- ২. ২য় নোটিফিকেশন (সকাল ১১:৫০ AM) ---
    if (myRankYesterdayNum === 0) {
      messagesByIndex[2] = {
        title: `⚠️ গতকাল আপনার কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `গতকাল ইবাদতে কোনো র্যাঙ্ক নেই (অসম্পূর্ণ আমল, র্যাঙ্ক #0)। গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} | ৩০ দিনের হাইস্কোর: ${highScore30}। আজকের আমল সম্পূর্ণ করে নিজের ইবাদতের উন্নতি করুন ও আখিরাত সুন্দর করুন।`
      };
    } else if (isYesterdayBest) {
      messagesByIndex[2] = {
        title: `🏆মাশাআল্লাহ! আপনিই গতকালকের সেরা! 👑${myRankYesterday}`,
        body: `গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} |৩০ দিনের হাইস্কোর: ${highScore30}। নিজের ইবাদতের উন্নতি করে আখিরাত সুন্দর করুন।`
      };
    } else {
      messagesByIndex[2] = {
        title: `গতকাল লিডারবোর্ডে আপনি ছিলেন ${myRankYesterday}`,
        body: `গত ৭ দিন: ${score7Days} | ৩০ দিন: ${score30Days} |৩০ দিনের হাইস্কোর: ${highScore30}। নিজের ইবাদতের উন্নতি করে আখিরাত সুন্দর করুন।`
      };
    }

    // --- ৩. ৩য় নোটিফিকেশন (রাত ৮:৩০ PM) ---
    if (myRankToday === 0) {
      messagesByIndex[3] = {
        title: `⚠️ আজকে ইবাদতে কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `${topPoints > 0 ? `প্রথম স্থানে আছেন ${topName} (${topPoints})। ` : ''}আজকে আপনার র্যাঙ্ক #0 — ইবাদতে অসম্পূর্ণ আমল। প্রথম স্থানে যেতে প্রয়োজন ${pointsNeeded} পয়েন্ট। এখনই আমল শুরু করে ইবাদতে এগিয়ে যান ও আখিরাত সুন্দর করুন।`
      };
    } else if (isTodayBest) {
      messagesByIndex[3] = {
        title: `🏆 মাশাআল্লাহ! আপনিই আজকের সেরা!`,
        body: `আজকের পয়েন্ট:👑 ${myPointsToday}। গতকাল ছিল: ${myPointsYesterday}। আরও বেশি আমল করে আখিরাতে নিজের মর্যাদা বৃদ্ধি করুন!`
      };
    } else {
      messagesByIndex[3] = {
        title: leaderHeader,
        body: `আজকে আপনার র্যাঙ্ক #${myRankToday}। প্রথম স্থানে যেতে প্রয়োজন আর ${pointsNeeded} পয়েন্ট। নিজের আমল বৃদ্ধি করে ১ নম্বরে উঠে আসুন এবং আখিরাত সুন্দর করুন।`
      };
    }

    // --- ৪. ৪র্থ নোটিফিকেশন (রাত ৯:০০ PM) ---
    if (myRankToday === 0) {
      messagesByIndex[4] = {
        title: `⚠️ আজকে ইবাদতে কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `${topPoints > 0 ? `প্রথম স্থানে আছেন ${topName} (${topPoints})। ` : ''}আজকে আপনার র্যাঙ্ক #0 — ইবাদতে অসম্পূর্ণ আমল। প্রথম স্থানে যেতে প্রয়োজন ${pointsNeeded} পয়েন্ট। নিজের আমল সম্পূর্ণ করে আখিরাত সুন্দর করুন।`
      };
    } else if (isTodayBest) {
      messagesByIndex[4] = {
        title: `🏆 মাশাআল্লাহ! আপনিই আজকের সেরা!`,
        body: `আজকের পয়েন্ট: 👑${myPointsToday}। গতকাল ছিল: ${myPointsYesterday}। আরও বেশি আমল করে আখিরাতে নিজের মর্যাদা বৃদ্ধি করুন!`
      };
    } else {
      messagesByIndex[4] = {
        title: leaderHeader,
        body: `আজকে আপনার র্যাঙ্ক #${myRankToday}। প্রথম স্থানে যেতে প্রয়োজন আর ${pointsNeeded} পয়েন্ট। নিজের আমল বৃদ্ধি করে ১ নম্বরে উঠে আসুন এবং আখিরাত সুন্দর করুন।`
      };
    }

    // --- ৫. ৫ম নোটিফিকেশন (রাত ১০:০০ PM) ---
    if (myRankToday === 0) {
      messagesByIndex[5] = {
        title: `⚠️ আজকে ইবাদতে কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `${topPoints > 0 ? `প্রথম স্থানে আছেন ${topName} (${topPoints})। ` : ''}আজকে আপনার র্যাঙ্ক #0 — ইবাদতে অসম্পূর্ণ আমল। প্রথম স্থানে যেতে প্রয়োজন ${pointsNeeded} পয়েন্ট। এখনই বাকি আমলগুলো আদায় করে আখিরাত সুন্দর করুন।`
      };
    } else if (isTodayBest) {
      messagesByIndex[5] = {
        title: `🏆 মাশাআল্লাহ! আপনিই আজকের সেরা!`,
        body: `আজকের পয়েন্ট:👑 ${myPointsToday}। গতকাল ছিল: ${myPointsYesterday}। আরও বেশি আমল করে আখিরাতে নিজের মর্যাদা বৃদ্ধি করুন!`
      };
    } else {
      messagesByIndex[5] = {
        title: leaderHeader,
        body: `আজকে আপনার র্যাঙ্ক #${myRankToday}। প্রথম স্থানে যেতে প্রয়োজন আর ${pointsNeeded} পয়েন্ট। নিজের আমল বৃদ্ধি করে ১ নম্বরে উঠে আসুন এবং আখিরাত সুন্দর করুন।`
      };
    }

    // --- ৬. ৬ষ্ঠ নোটিফিকেশন (রাত ১১:০০ PM - শেষ) ---
    if (myRankToday === 0) {
      messagesByIndex[6] = {
        title: `⚠️ রাতের শেষ ঘণ্টা! আজকে ইবাদতে কোনো র্যাঙ্ক নেই (র্যাঙ্ক #0)`,
        body: `আপনার আজকের পয়েন্ট: 0 (র্যাঙ্ক #0 — ইবাদতে অসম্পূর্ণ আমল)। এখনো সময় আছে—বাকি আমলগুলো সম্পন্ন করে ওযু করে সকল দু'আ পড়ে তাহাজ্জুদের নিয়ত করে ঘুমোন। শুভ রাত্রি।`
      };
    } else if (isTodayBest) {
      messagesByIndex[6] = {
        title: `👑 আজকের ইবাদতে আপনি শীর্ষে! মাশাআল্লাহ, অনেক ভালো!`,
        body: `আপনার পয়েন্ট: ${myRealTimePoints}। এতো ভালো পারফরম্যান্সের পর, ওযু করে সকল দু'আ পড়ে তাহাজ্জুদের নিয়ত করে ঘুমোচ্ছেন তো? আল্লাহ কবুল করুন! শুভ রাত্রি।`
      };
    } else {
      messagesByIndex[6] = {
        title: `😴 রাতের শেষ ঘণ্টা! আপনার আজকের অর্জন #${myRankToday}`,
        body: `আপনার আজকের ফল: ${myRealTimePoints}। আপনি যথেষ্ট চেষ্টা করেছেন, আলহামদুলিল্লাহ! এখন ওযু করে সকল দু'আ পড়ে তাহাজ্জুদের নিয়ত করে ঘুমোচ্ছেন তো? শুভ রাত্রি।`
      };
    }

    // --- ৭. শূন্য (০) পয়েন্ট সতর্কতা ---
    messagesByIndex[7] = {
      title: "⚠️ আজকের কোনো ইবাদত পয়েন্ট নেই!",
      body: "আজকে আপনার কোনো ইবাদত পয়েন্ট নেই বা আপনি ইবাদতে অমনোযোগী হয়ে গেছেন। আপনার ইবাদত ঠিক রাখার জন্য এবং উন্নতি করার জন্য নিয়মিত ইবাদত ট্র্যাকিং ও হিসাব রাখুন, ইনশাআল্লাহ উন্নতি আসবে। এবং আল্লাহর কাছে হেদায়েতের জন্য দু'আ করুন।"
    };

    return { myRealTimePoints, messagesByIndex };
  }

  /**
   * ৬টি নোটিফিকেশন + শূন্য (০) পয়েন্ট সতর্কতা নোটিফিকেশন শিডিউলার
   * দৈনিক সকাল ৯:৫০, সকাল ১১:৫০, রাত ৮:৩০, রাত ৯:০০, রাত ১০:০০, রাত ১১:০০ এবং শূন্য পয়েন্ট থাকলে ঠিক পরপরই সতর্কতা নোটিফিকেশন সেট ও আপডেট করে
   */
  static async scheduleDynamicNightlyNotifications(): Promise<void> {
    try {
      const { myRealTimePoints, messagesByIndex } = await this.buildNightlyNotificationContext();

      // ৪. ৬টি নোটিফিকেশনের সময় এবং ইনডেক্স
      // ১ম: সকাল ৯:৫০ AM, ২য়: সকাল ১১:৫০ AM, ৩য়: রাত ৮:৩০ PM, ৪র্থ: রাত ৯:০০ PM, ৫ম: রাত ১০:০০ PM, ৬ষ্ঠ: রাত ১১:০০ PM
      const reminders = [
        { id: 70001, hour: 9, minute: 50, index: 1 },  // ১ম নোটিফিকেশন (সকাল ৯:৫০ AM)
        { id: 70002, hour: 11, minute: 50, index: 2 }, // ২য় নোটিফিকেশন (সকাল ১১:৫০ AM)
        { id: 70003, hour: 20, minute: 30, index: 3 }, // ৩য় নোটিফিকেশন (রাত ৮:৩০ PM)
        { id: 70004, hour: 21, minute: 0, index: 4 },  // ৪র্থ নোটিফিকেশন (রাত ৯:০০ PM)
        { id: 70005, hour: 22, minute: 0, index: 5 },  // ৫ম নোটিফিকেশন (রাত ১০:০০ PM)
        { id: 70006, hour: 23, minute: 0, index: 6 }   // ৬ষ্ঠ নোটিফিকেশন (রাত ১১:০০ PM)
      ];

      // ৬. কর্ডোভা শিডিউল বা আপডেট লজিক
      if (typeof window !== 'undefined' && window.cordova?.plugins?.notification?.local) {
        this.ensureChannels();
        const local = window.cordova.plugins.notification.local;
        const soundSetting = window.device?.platform === 'Android' ? 'res://raw/reminder_sound2' : true;
        const notificationsToSchedule: any[] = [];
        const zeroFollowUpIdsToCancel: number[] = [];

        const zeroMsg = messagesByIndex[7];

        reminders.forEach((r) => {
          const msg = messagesByIndex[r.index];
          if (!msg) return;

          const triggerDate = new Date();
          triggerDate.setHours(r.hour, r.minute, 0, 0);
          if (triggerDate.getTime() <= Date.now()) {
            triggerDate.setDate(triggerDate.getDate() + 1);
          }

          notificationsToSchedule.push({
            id: r.id,
            title: msg.title,
            text: msg.body,
            trigger: {
              at: triggerDate,
              every: 'day'
            },
            foreground: true,
            wakeup: true,
            vibrate: true,
            priority: 2,
            importance: 4,
            channel: 'night_leaderboard_v2',
            channelName: 'Nightly Leaderboard',
            channelDescription: 'রাতের লিডারবোর্ড ও আমল রিমাইন্ডার',
            lockscreenVisibility: 1,
            sound: soundSetting
          });

          // যদি ওই দিনে ব্যবহারকারীর পয়েন্ট ০ থাকে, তবে পরের ৪টি নোটিফিকেশনের (৩-৬) ঠিক পরপরই (৬ সেকেন্ড পর) ২য় নোটিফিকেশন হিসেবে শূন্য পয়েন্ট সতর্কতা আসবে
          const zeroFollowUpId = r.id + 100; // 70103, 70104, 70105, 70106
          if (r.index >= 3 && r.index <= 6 && myRealTimePoints === 0) {
            const zeroTriggerDate = new Date();
            zeroTriggerDate.setHours(r.hour, r.minute, 6, 0);
            if (zeroTriggerDate.getTime() <= Date.now()) {
              zeroTriggerDate.setDate(zeroTriggerDate.getDate() + 1);
            }

            notificationsToSchedule.push({
              id: zeroFollowUpId,
              title: zeroMsg.title,
              text: zeroMsg.body,
              trigger: {
                at: zeroTriggerDate,
                every: 'day'
              },
              foreground: true,
              wakeup: true,
              vibrate: true,
              priority: 2,
              importance: 4,
              channel: 'night_leaderboard_v2',
              channelName: 'Nightly Leaderboard',
              channelDescription: 'রাতের লিডারবোর্ড ও আমল রিমাইন্ডার',
              lockscreenVisibility: 1,
              sound: soundSetting
            });
          } else {
            zeroFollowUpIdsToCancel.push(zeroFollowUpId);
          }
        });

        if (zeroFollowUpIdsToCancel.length > 0) {
          local.cancel(zeroFollowUpIdsToCancel);
        }

        if (notificationsToSchedule.length > 0) {
          local.schedule(notificationsToSchedule);
          console.log(`[Cordova] Scheduled/updated ${notificationsToSchedule.length} nightly leaderboard notifications.`);
        }
      }
    } catch (error) {
      console.error("Error setting custom notifications:", error);
    }
  }

  /**
   * নির্দিষ্ট ইনডেক্সের (১-৬ অথবা শূন্য পয়েন্টের ৭) নোটিফিকেশন মেসেজ তৈরি করে
   */
  static async getNightlyMessageForIndex(index: number): Promise<{ title: string; body: string } | null> {
    try {
      const { messagesByIndex } = await this.buildNightlyNotificationContext();
      return messagesByIndex[index] || null;
    } catch {
      return null;
    }
  }

  /**
   * টেস্ট করার জন্য নোটিফিকেশন তাৎক্ষণিক ট্রিগার করে (ওয়েব এবং কর্ডোভা উভয়তেই সাউন্ডসহ বাজবে)
   * যদি ইউজারের আজকের পয়েন্ট ০ থাকে অথবা forceZero সত্য হয়, তবে ১-৬ প্রতিটি নোটিফিকেশনের ঠিক পরপরই ২য় নোটিফিকেশন হিসেবে শূন্য পয়েন্ট সতর্কতা আসবে
   */
  static async triggerTestNightly(
    index: number,
    onFollowUp?: (title: string, body: string) => void,
    forceZero: boolean = false
  ): Promise<{ title: string; body: string; hasFollowUpZero?: boolean } | null> {
    const msg = await this.getNightlyMessageForIndex(index);
    const todayPts = repository.calculatePoints(repository.getTodayKey());
    const isZero = forceZero || todayPts === 0;

    if (!msg) {
      if (index === 7) {
        // টেস্ট করার জন্য শূন্য পয়েন্ট বার্তা প্রদর্শন
        const testZero = {
          title: "⚠️ আজকের কোনো ইবাদত পয়েন্ট নেই!",
          body: "আজকে আপনার কোনো ইবাদত পয়েন্ট নেই বা আপনি ইবাদতে অমনোযোগী হয়ে গেছেন। আপনার ইবাদত ঠিক রাখার জন্য এবং উন্নতি করার জন্য নিয়মিত ইবাদত ট্র্যাকিং ও হিসাব রাখুন, ইনশাআল্লাহ উন্নতি আসবে। এবং আল্লাহর কাছে হেদায়েতের জন্য দু'আ করুন।"
        };
        this.sendNotification(testZero.title, testZero.body);
        return { ...testZero, hasFollowUpZero: false };
      }
      return null;
    }

    this.sendNotification(msg.title, msg.body);

    // পরের ৪টি নোটিফিকেশনের (৩-৬) যেকোনোটি টেস্ট করার সময় যদি ইউজারের পয়েন্ট ০ থাকে (অথবা forceZero থাকে),
    // তবে ২.৫ সেকেন্ড পরই ফলো-আপ হিসেবে ২য় নোটিফিকেশন (শূন্য পয়েন্ট সতর্কবার্তা) বাজবে ও প্রদর্শিত হবে
    const shouldTriggerFollowUp = index >= 3 && index <= 6 && isZero;
    if (shouldTriggerFollowUp) {
      setTimeout(() => {
        const zeroMsg = {
          title: "⚠️ আজকের কোনো ইবাদত পয়েন্ট নেই!",
          body: "আজকে আপনার কোনো ইবাদত পয়েন্ট নেই বা আপনি ইবাদতে অমনোযোগী হয়ে গেছেন। আপনার ইবাদত ঠিক রাখার জন্য এবং উন্নতি করার জন্য নিয়মিত ইবাদত ট্র্যাকিং ও হিসাব রাখুন, ইনশাআল্লাহ উন্নতি আসবে। এবং আল্লাহর কাছে হেদায়েতের জন্য দু'আ করুন।"
        };
        this.sendNotification(zeroMsg.title, zeroMsg.body);
        if (onFollowUp) {
          onFollowUp(zeroMsg.title, zeroMsg.body);
        }
      }, 2500);
    }

    return { ...msg, hasFollowUpZero: shouldTriggerFollowUp };
  }
}
