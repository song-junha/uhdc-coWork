import { getDatabase } from './index';
import type { CalendarEvent, CreateEventDto, UpdateEventDto } from '../../shared/types/calendar.types';

export function rowToEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    memo: row.memo as string,
    eventDate: row.event_date as string,
    eventTime: row.event_time as string,
    repeatType: row.repeat_type as CalendarEvent['repeatType'],
    alertBefore: row.alert_before as number,
    isSnoozed: (row.is_snoozed as number) === 1,
    snoozeUntil: row.snooze_until as string | null,
    remoteId: (row.remote_id as string) ?? null,
    syncedAt: (row.synced_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? row.created_at as string,
  };
}

/**
 * Expand a repeating event into virtual occurrences for a given month.
 * Only generates dates on or after the original event date.
 */
function expandRepeatForMonth(event: CalendarEvent, year: number, month: number): CalendarEvent[] {
  const origDate = new Date(event.eventDate + 'T00:00:00');
  const daysInMonth = new Date(year, month, 0).getDate();
  const results: CalendarEvent[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const candidate = new Date(year, month - 1, day);
    // Don't generate occurrences before the original event date
    if (candidate < origDate) continue;

    let matches = false;
    switch (event.repeatType) {
      case 'daily':
        matches = true;
        break;
      case 'weekly':
        matches = candidate.getDay() === origDate.getDay();
        break;
      case 'monthly':
        matches = day === origDate.getDate();
        break;
    }

    if (matches) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      results.push({ ...event, eventDate: dateStr });
    }
  }

  return results;
}

/**
 * Check if a repeating event matches a specific date.
 */
function repeatMatchesDate(event: CalendarEvent, dateStr: string): boolean {
  const origDate = new Date(event.eventDate + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  if (target < origDate) return false;

  switch (event.repeatType) {
    case 'daily':
      return true;
    case 'weekly':
      return target.getDay() === origDate.getDay();
    case 'monthly':
      return target.getDate() === origDate.getDate();
    default:
      return false;
  }
}

export function getEvents(year: number, month: number): CalendarEvent[] {
  const db = getDatabase();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // Get non-repeating events in range
  const nonRepeating = db.prepare(`
    SELECT * FROM calendar_events
    WHERE repeat_type = 'none' AND event_date >= ? AND event_date < ?
    ORDER BY event_date ASC, event_time ASC
  `).all(startDate, endDate) as Record<string, unknown>[];

  // Get all repeating events (created on or before end of this month)
  const repeating = db.prepare(`
    SELECT * FROM calendar_events
    WHERE repeat_type != 'none' AND event_date < ?
    ORDER BY event_time ASC
  `).all(endDate) as Record<string, unknown>[];

  const result: CalendarEvent[] = nonRepeating.map(rowToEvent);

  // Expand repeating events into virtual occurrences for this month
  for (const row of repeating) {
    const event = rowToEvent(row);
    result.push(...expandRepeatForMonth(event, year, month));
  }

  // Sort by date then time
  result.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.eventTime.localeCompare(b.eventTime));

  return result;
}

export function createEvent(data: CreateEventDto): CalendarEvent {
  const db = getDatabase();
  const info = db.prepare(`
    INSERT INTO calendar_events (title, memo, event_date, event_time, repeat_type, alert_before)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.title,
    data.memo ?? '',
    data.eventDate,
    data.eventTime,
    data.repeatType ?? 'none',
    data.alertBefore ?? 0,
  );

  return rowToEvent(
    db.prepare('SELECT * FROM calendar_events WHERE rowid = ?').get(info.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateEvent(id: string, data: UpdateEventDto): CalendarEvent {
  const db = getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.memo !== undefined) { sets.push('memo = ?'); params.push(data.memo); }
  if (data.eventDate !== undefined) { sets.push('event_date = ?'); params.push(data.eventDate); }
  if (data.eventTime !== undefined) { sets.push('event_time = ?'); params.push(data.eventTime); }
  if (data.repeatType !== undefined) { sets.push('repeat_type = ?'); params.push(data.repeatType); }
  if (data.alertBefore !== undefined) { sets.push('alert_before = ?'); params.push(data.alertBefore); }

  // Reset snooze when event is updated
  sets.push('is_snoozed = 0', 'snooze_until = NULL');
  sets.push("updated_at = datetime('now')");

  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  return rowToEvent(
    db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function deleteEvent(id: string): void {
  getDatabase().prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
}

export function getTodayAlerts(): CalendarEvent[] {
  const db = getDatabase();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Non-repeating events for today + all repeating events
  const rows = db.prepare(`
    SELECT * FROM calendar_events
    WHERE (event_date = ? AND repeat_type = 'none')
       OR (repeat_type != 'none' AND event_date <= ?)
    ORDER BY event_time ASC
  `).all(today, today) as Record<string, unknown>[];

  return rows
    .map(rowToEvent)
    .filter(event => {
      // Filter snoozed events that are still within snooze period
      if (event.isSnoozed && event.snoozeUntil) {
        if (new Date(event.snoozeUntil) > now) return false;
      }
      // For repeating events, check if today matches
      if (event.repeatType !== 'none') {
        return repeatMatchesDate(event, today);
      }
      return true;
    })
    .map(event => {
      // Set eventDate to today for repeating events (for UI consistency)
      if (event.repeatType !== 'none') {
        return { ...event, eventDate: today };
      }
      return event;
    });
}

export function snoozeEvent(id: string, minutes: number): void {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  getDatabase().prepare(
    'UPDATE calendar_events SET is_snoozed = 1, snooze_until = ? WHERE id = ?'
  ).run(snoozeUntil, id);
}

/** Get all calendar events (for sync) */
export function getAllEvents(): CalendarEvent[] {
  const rows = getDatabase().prepare('SELECT * FROM calendar_events').all() as Record<string, unknown>[];
  return rows.map(rowToEvent);
}
