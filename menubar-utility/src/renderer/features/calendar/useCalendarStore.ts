import { create } from 'zustand';
import type { CalendarEvent, CreateEventDto, UpdateEventDto } from '../../../shared/types/calendar.types';

interface CalendarStore {
  events: CalendarEvent[];
  todayAlerts: CalendarEvent[];
  selectedDate: string;
  currentYear: number;
  currentMonth: number;
  showEventForm: boolean;
  editingEvent: CalendarEvent | null;

  fetchEvents: () => Promise<void>;
  fetchTodayAlerts: () => Promise<void>;
  createEvent: (data: CreateEventDto) => Promise<void>;
  updateEvent: (id: string, data: UpdateEventDto) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  snoozeEvent: (id: string, minutes: number) => Promise<void>;
  setSelectedDate: (date: string) => void;
  navigateMonth: (delta: number) => void;
  setShowEventForm: (show: boolean) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
}

const now = new Date();

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  todayAlerts: [],
  selectedDate: now.toISOString().split('T')[0],
  currentYear: now.getFullYear(),
  currentMonth: now.getMonth() + 1,
  showEventForm: false,
  editingEvent: null,

  fetchEvents: async () => {
    const { currentYear, currentMonth } = get();
    const events = await window.electronAPI.calendar.getEvents(currentYear, currentMonth);
    set({ events });
  },

  fetchTodayAlerts: async () => {
    const alerts = await window.electronAPI.calendar.getTodayAlerts();
    set({ todayAlerts: alerts });
  },

  createEvent: async (data) => {
    await window.electronAPI.calendar.createEvent(data);
    await get().fetchEvents();
    await get().fetchTodayAlerts();
  },

  updateEvent: async (id, data) => {
    await window.electronAPI.calendar.updateEvent(id, data);
    await get().fetchEvents();
    await get().fetchTodayAlerts();
  },

  deleteEvent: async (id) => {
    await window.electronAPI.calendar.deleteEvent(id);
    await get().fetchEvents();
    await get().fetchTodayAlerts();
  },

  snoozeEvent: async (id, minutes) => {
    await window.electronAPI.calendar.snooze(id, minutes);
    await get().fetchTodayAlerts();
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  navigateMonth: (delta) => {
    set((state) => {
      let month = state.currentMonth + delta;
      let year = state.currentYear;
      if (month > 12) { month = 1; year++; }
      if (month < 1) { month = 12; year--; }
      return { currentMonth: month, currentYear: year };
    });
    get().fetchEvents();
    get().fetchTodayAlerts();
  },

  setShowEventForm: (show) => set({ showEventForm: show }),
  setEditingEvent: (event) => set({ editingEvent: event, showEventForm: !!event }),
}));
