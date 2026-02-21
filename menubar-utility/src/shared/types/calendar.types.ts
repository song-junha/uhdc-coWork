export interface CalendarEvent {
  id: string;
  title: string;
  memo: string;
  eventDate: string;
  eventTime: string;
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly';
  alertBefore: number;
  isSnoozed: boolean;
  snoozeUntil: string | null;
  remoteId: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventDto {
  title: string;
  memo?: string;
  eventDate: string;
  eventTime: string;
  repeatType?: CalendarEvent['repeatType'];
  alertBefore?: number;
}

export interface UpdateEventDto {
  title?: string;
  memo?: string;
  eventDate?: string;
  eventTime?: string;
  repeatType?: CalendarEvent['repeatType'];
  alertBefore?: number;
}
