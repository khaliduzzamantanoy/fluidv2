'use client';

import { useState } from 'react';
import { Settings, User, Shield, Bell, LogOut, Eye, EyeOff, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface SettingsPageProps {
  user: any;
  onLogout: () => void;
}

export default function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(user?.settings || '{}')?.theme || 'dark'; } catch { return 'dark'; }
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, theme })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-800/80 pb-0.5">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'notifications', label: 'Notifications', icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition ${
              activeTab === tab.id ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center space-x-2 p-3 rounded-lg text-xs ${
          message.type === 'success' ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' :
          'bg-red-950/40 border border-red-800/60 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Profile Information</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Username</label>
              <input type="text" value={user?.username || ''} disabled className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm opacity-60" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <input type="text" value={user?.role || ''} disabled className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm opacity-60" />
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving} className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Change Password</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Current Password</label>
              <div className="relative">
                <input type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">New Password</label>
              <input type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirm New Password</label>
              <input type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-sm focus:border-brand-500 outline-none" />
            </div>
            <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showPasswords} onChange={() => setShowPasswords(!showPasswords)} className="rounded border-gray-600 text-brand-500 focus:ring-brand-500" />
              <span>Show passwords</span>
            </label>
          </div>
          <button onClick={changePassword} disabled={saving} className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>{saving ? 'Changing...' : 'Change Password'}</span>
          </button>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Notification Preferences</h3>
          <p className="text-xs text-gray-500">Notification settings coming soon.</p>
        </div>
      )}

      {/* Logout */}
      <div className="border-t border-gray-800/80 pt-6">
        <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}