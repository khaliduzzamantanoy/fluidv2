'use client';

import { useState, useEffect } from 'react';
import AuthPage from '@/components/AuthPage';
import AppShell from '@/components/AppShell';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [authState, setAuthState] = useState<'loading' | 'setup' | 'login' | 'authenticated'>('loading');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          setAuthState('authenticated');
          return;
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }

    // Check if setup is needed
    try {
      const setupRes = await fetch('/api/auth/check-setup');
      const setupData = await setupRes.json();
      if (setupData.success) {
        setAuthState(setupData.needsSetup ? 'setup' : 'login');
      } else {
        setAuthState('login');
      }
    } catch {
      setAuthState('login');
    }
  };

  const handleAuthenticated = (userData: any, token: string) => {
    setUser(userData);
    setAuthState('authenticated');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setAuthState('login');
  };

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (authState === 'authenticated' && user) {
    return <AppShell user={user} onLogout={handleLogout} />;
  }

  return <AuthPage onAuthenticated={handleAuthenticated} />;
}