// Theme Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      
      setTheme: (theme) => set({ theme }),
      
      toggleTheme: () => {
        const current = get().theme;
        if (current === 'light') {
          set({ theme: 'dark' });
        } else if (current === 'dark') {
          set({ theme: 'light' });
        } else {
          set({ theme: 'light' });
        }
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);
