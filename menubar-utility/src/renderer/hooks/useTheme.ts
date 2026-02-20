import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme === 'system') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

export const useTheme = create<ThemeStore>((set) => ({
  theme: 'system',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    window.electronAPI.settings.set('theme', theme);
  },
}));

// Hydrate from DB on startup
window.electronAPI?.settings.get('theme').then((saved) => {
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    applyTheme(saved);
    useTheme.setState({ theme: saved });
  }
});
