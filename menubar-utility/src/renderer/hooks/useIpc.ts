import { useEffect } from 'react';

export function useElectronAPI() {
  return window.electronAPI;
}

export function useIpcEvent(channel: string, callback: (...args: unknown[]) => void) {
  useEffect(() => {
    window.electronAPI.on(channel, callback);
    return () => {
      window.electronAPI.off(channel);
    };
  }, [channel, callback]);
}
