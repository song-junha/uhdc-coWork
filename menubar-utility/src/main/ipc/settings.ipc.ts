import { ipcMain, safeStorage } from 'electron';
import * as settingsRepo from '../db/settings.repo';

const SENSITIVE_KEYS = new Set(['jira_api_token']);

function encryptValue(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64');
  }
  return value;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    const value = settingsRepo.getSetting(key);
    if (SENSITIVE_KEYS.has(key) && value) {
      return '[encrypted]';
    }
    return value;
  });

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    if (SENSITIVE_KEYS.has(key) && value) {
      settingsRepo.setSetting(key, encryptValue(value));
    } else {
      settingsRepo.setSetting(key, value);
    }
  });

  ipcMain.handle('settings:getAll', () => {
    const all = settingsRepo.getAllSettings();
    for (const key of SENSITIVE_KEYS) {
      if (all[key]) {
        all[key] = '[encrypted]';
      }
    }
    return all;
  });
}
