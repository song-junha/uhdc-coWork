import { ipcMain } from 'electron';
import * as calendarRepo from '../db/calendar.repo';
import type { CreateEventDto, UpdateEventDto } from '../../shared/types/calendar.types';

export function registerCalendarHandlers(): void {
  ipcMain.handle('calendar:getEvents', (_event, year: number, month: number) => {
    return calendarRepo.getEvents(year, month);
  });

  ipcMain.handle('calendar:createEvent', (_event, data: CreateEventDto) => {
    return calendarRepo.createEvent(data);
  });

  ipcMain.handle('calendar:updateEvent', (_event, id: string, data: UpdateEventDto) => {
    return calendarRepo.updateEvent(id, data);
  });

  ipcMain.handle('calendar:deleteEvent', (_event, id: string) => {
    calendarRepo.deleteEvent(id);
  });

  ipcMain.handle('calendar:getTodayAlerts', () => {
    return calendarRepo.getTodayAlerts();
  });

  ipcMain.handle('calendar:snooze', (_event, id: string, minutes: number) => {
    calendarRepo.snoozeEvent(id, minutes);
  });
}
