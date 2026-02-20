import { Notification, BrowserWindow } from 'electron';
import * as calendarRepo from '../db/calendar.repo';
import type { CalendarEvent } from '../../shared/types/calendar.types';

let intervalId: ReturnType<typeof setInterval> | null = null;
const firedThisMinute = new Set<string>();

function shouldAlertNow(event: CalendarEvent): boolean {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Calculate alert time (considering alertBefore)
  const eventDateTime = new Date(`${event.eventDate}T${event.eventTime}:00`);
  const alertDateTime = new Date(eventDateTime.getTime() - event.alertBefore * 60 * 1000);
  const alertTime = `${String(alertDateTime.getHours()).padStart(2, '0')}:${String(alertDateTime.getMinutes()).padStart(2, '0')}`;

  return alertTime === currentTime;
}

function fireNotification(event: CalendarEvent): void {
  // Prevent duplicate notifications in the same minute
  const key = `${event.id}:${event.eventDate}`;
  if (firedThisMinute.has(key)) return;
  firedThisMinute.add(key);

  const notification = new Notification({
    title: event.title,
    body: event.eventTime + (event.memo ? ` - ${event.memo}` : ''),
    silent: false,
  });

  notification.on('click', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].show();
      windows[0].webContents.send('alert:fire', event);
    }
  });

  notification.show();
}

function checkAlerts(): void {
  try {
    // getTodayAlerts already handles repeat expansion + snooze filtering
    const events = calendarRepo.getTodayAlerts();
    for (const event of events) {
      if (shouldAlertNow(event)) {
        fireNotification(event);
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

export function startScheduler(): void {
  if (intervalId) return;

  // Check every 30 seconds for better accuracy
  intervalId = setInterval(() => {
    checkAlerts();
  }, 30 * 1000);

  // Clear fired set every minute to allow next-minute alerts
  setInterval(() => {
    firedThisMinute.clear();
  }, 60 * 1000);

  // Check immediately on start
  checkAlerts();
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
