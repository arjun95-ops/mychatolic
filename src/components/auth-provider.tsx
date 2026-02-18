'use client';

import * as React from 'react';
import { useAuth } from '@/lib/features/auth/use-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
