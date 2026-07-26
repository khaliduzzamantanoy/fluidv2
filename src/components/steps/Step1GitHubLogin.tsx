'use client';

import { useState, useEffect } from 'react';
import { Github, Key, CheckCircle, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';

interface Step1Props {
  onNext: (data: { githubToken: string; user?: any }) => void;
}

export default function Step1GitHubLogin({ onNext }: Step1Props) {
  const [clientId, setClientId] = useState('');
  const [showCustomClient, setShowCustomClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceData, setDeviceData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [pollStatus, setPollStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const startDeviceFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: showCustomClient ? clientId : '' })
      });
      const data = await res.json();

      if (data.success && data.user_code) {
        setDeviceData(data);
        setPollStatus('polling');
      } else {
        setError(data.error || 'Failed to initiate GitHub Device Code flow');
      }
    } catch (err: any) {
      setError(err.message || 'Network error initiating login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (pollStatus === 'polling' && deviceData?.device_code) {
      const interval = (deviceData.interval || 5) * 1000;

      const poll = async () => {
        try {
          const res = await fetch('/api/github/poll-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: deviceData.clientId,
              deviceCode: deviceData.device_code
            })
          });
          const data = await res.json();

          if (data.success && data.accessToken) {
            setPollStatus('success');
            onNext({ githubToken: data.accessToken });
          } else if (data.error === 'authorization_pending') {
            timer = setTimeout(poll, interval);
          } else if (data.error === 'slow_down') {
            timer = setTimeout(poll, interval + 5000);
          } else {
            setPollStatus('failed');
            setError(data.error_description || data.error || 'Authorization expired or failed');
          }
        } catch (e) {
          timer = setTimeout(poll, interval);
        }
      };

      timer = setTimeout(poll, interval);
    }

    return () => clearTimeout(timer);
  }, [pollStatus, deviceData]);

  const copyCode = () => {
    if (deviceData?.user_code) {
      navigator.clipboard.writeText(deviceData.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Github className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Connect Your GitHub Account</h2>
        <p className="text-sm text-gray-400">
          Fluid uses GitHub Device Authorization. No database, no client secret, and no personal access tokens required.
        </p>
      </div>

      {!deviceData ? (
        <div className="max-w-md mx-auto space-y-4">
          <button
            onClick={startDeviceFlow}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold shadow-lg shadow-brand-500/20 transition duration-200 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Github className="w-5 h-5" />
            )}
            <span>{loading ? 'Initiating Login...' : 'Login with GitHub'}</span>
          </button>

          <div className="text-center">
            <button
              onClick={() => setShowCustomClient(!showCustomClient)}
              className="text-xs text-gray-400 hover:text-brand-400 underline transition"
            >
              {showCustomClient ? 'Use Default Client ID' : 'Use Custom GitHub Client ID'}
            </button>
          </div>

          {showCustomClient && (
            <div className="p-3 bg-dark-card rounded-lg border border-gray-800 space-y-2">
              <label className="text-xs text-gray-300 font-mono">Custom GITHUB_CLIENT_ID:</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. Ov23li44..."
                className="w-full px-3 py-2 text-sm bg-dark-bg border border-gray-700 rounded text-white font-mono focus:border-brand-500 outline-none"
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-md mx-auto glass-panel p-6 rounded-2xl border border-brand-500/30 shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-400 font-semibold">User Verification Code</span>
            <div className="flex items-center justify-center space-x-3 mt-2">
              <span className="text-3xl font-mono font-bold tracking-widest text-white px-4 py-2 bg-dark-bg rounded-lg border border-brand-500/40">
                {deviceData.user_code}
              </span>
              <button
                onClick={copyCode}
                className="p-2.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition"
                title="Copy Code"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={deviceData.verification_uri || 'https://github.com/login/device'}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition"
            >
              <span>1. Open github.com/login/device</span>
              <ExternalLink className="w-4 h-4 text-brand-400" />
            </a>

            <div className="p-3 bg-dark-bg/80 rounded-xl border border-gray-800 flex items-center justify-center space-x-3 text-xs text-gray-300">
              <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" />
              <span>Waiting for approval on GitHub...</span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
