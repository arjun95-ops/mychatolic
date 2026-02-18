'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

export function ThemeModeFab() {
  const { resolvedTheme, setTheme } = useTheme();
  if (!resolvedTheme) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-[70] lg:bottom-4">
      <Button
        type="button"
        size="sm"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="pointer-events-auto h-10 rounded-full border border-border/80 bg-card/90 px-4 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-md hover:bg-muted"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span className="text-xs font-semibold">{isDark ? 'White Mode' : 'Dark Mode'}</span>
      </Button>
    </div>
  );
}
