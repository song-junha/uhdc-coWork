import { ipcMain } from 'electron';
import * as settingsRepo from '../db/settings.repo';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return settingsRepo.getSetting(key);
  });

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    settingsRepo.setSetting(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    return settingsRepo.getAllSettings();
  });
}
