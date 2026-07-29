'use client';

import { useState, useEffect } from 'react';
import { Shield, Key, User, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Server, Loader2 } from 'lucide-react';

interface AuthPageProps {
  onAuthenticated: (user: any, token: string) => void;
  mode?: 'forceChange';
  user?: any;
  pendingToken?: string | null;
  onLogout?: () => void;
}

export default function AuthPage({ onAuthenticated, mode: forcedMode, user: forcedUser, pendingToken, onLogout }: AuthPageProps) {
  const [mode, setMode] = useState<'loading' | 'setup' | 'login' | 'forceChange'>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (forcedMode === 'forceChange') {
      setMode('forceChange');
      return;
    }
    checkSetup();
  }, [forcedMode]);

  const checkSetup = async () => {
    try {
      const res = await fetch('/api/auth/check-setup');
      const data = await res.json();
      if (data.success) {
        setMode(data.needsSetup ? 'setup' : 'login');
      }
    } catch {
      setMode('login');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email: email || undefined })
      });
      const data = await res.json();
      if (data.success) {
        onAuthenticated(data.user, data.token);
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        onAuthenticated(data.user, data.token);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleForceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const currentPw = password;
    const newPw = passwordConfirm;

    if (newPw.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (currentPw === newPw) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pendingToken || ''}`
        },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Password changed successfully!');
        setTimeout(() => {
          onAuthenticated(forcedUser || { username }, '');
        }, 1500);
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          <span className="text-sm">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 shadow-2xl shadow-brand-500/30 mb-4">
              <span className="text-3xl font-extrabold text-white">F</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'forceChange' ? 'Set Your Password' : mode === 'setup' ? 'Initialize Portal' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'forceChange'
                ? 'You must change your temporary password to continue'
                : mode === 'setup'
                  ? 'Create your admin account to get started'
                  : 'Sign in to manage your VPS'}
            </p>
          </div>

          <div className="bg-[#0c1222] border border-gray-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
            {mode === 'setup' ? (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="flex items-center space-x-2 px-3 py-2 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-300 text-xs">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>First-time setup: Create your admin credentials carefully.</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Email (optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start space-x-2 p-3 bg-red-950/40 border border-red-800/60 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  <span>{loading ? 'Creating Admin...' : 'Create Admin & Initialize'}</span>
                </button>
              </form>
            ) : mode === 'forceChange' ? (
              <form onSubmit={handleForceChange} className="space-y-4">
                <div className="flex items-center space-x-2 px-3 py-2 bg-red-950/30 border border-red-800/40 rounded-lg text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Password change required. Set a new password.</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter the temporary password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start space-x-2 p-3 bg-red-950/40 border border-red-800/60 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-start space-x-2 p-3 bg-green-950/40 border border-green-800/60 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-green-300">{success}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                  <span>{loading ? 'Updating...' : 'Set New Password'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#090d16] border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start space-x-2 p-3 bg-red-950/40 border border-red-800/60 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">
            FLUID VPS Portal v2.0 &mdash; Server Management Platform
          </p>
        </div>
      </div>
    </div>
  );
}
