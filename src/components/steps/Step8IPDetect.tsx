'use client';

import { useState, useEffect } from 'react';
import { Network, Copy, Check, ArrowRight, RefreshCw, Server } from 'lucide-react';

interface Step8Props {
  domain: string;
  wwwDomain: string;
  onNext: (vpsIp: string) => void;
}

export default function Step8IPDetect({ domain, wwwDomain, onNext }: Step8Props) {
  const [vpsIp, setVpsIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchIp() {
      setLoading(true);
      try {
        const res = await fetch('/api/system/ip');
        const data = await res.json();
        if (data.success && data.ip) {
          setVpsIp(data.ip);
        }
      } catch (e) {
        setVpsIp('127.0.0.1');
      } finally {
        setLoading(false);
      }
    }
    fetchIp();
  }, []);

  const copyIp = async () => {
    if (vpsIp) {
      try {
        await navigator.clipboard.writeText(vpsIp);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard API failed:', err);
        // Fallback for older browsers
        try {
          const textArea = document.createElement('textarea');
          textArea.value = vpsIp;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            console.error('Fallback copy failed');
          }
        } catch (fallbackErr) {
          console.error('Fallback copy error:', fallbackErr);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Network className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">VPS Public IP & DNS Records</h2>
        <p className="text-sm text-gray-400">
          Point your domain's DNS A records to this VPS IP address at your domain registrar.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-5">
        {/* VPS IP Card */}
        <div className="glass-panel p-6 rounded-2xl border border-brand-500/30 text-center space-y-2">
          <span className="text-xs uppercase tracking-widest text-brand-400 font-mono font-semibold">Your VPS Public IP Address</span>
          {loading ? (
            <div className="py-3 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-3 pt-1">
              <span className="text-3xl font-mono font-bold tracking-wider text-white">
                {vpsIp}
              </span>
              <button
                onClick={copyIp}
                className="p-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition"
                title="Copy IP"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>

        {/* DNS Configuration Table / Card */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-300 font-semibold uppercase tracking-wider pb-2 border-b border-gray-800">
            <Server className="w-4 h-4 text-brand-400" />
            <span>Create the Following DNS A Records:</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-dark-bg rounded-xl border border-gray-800 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center space-x-3">
                <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded font-bold">A</span>
                <span className="text-gray-200">@ ({domain})</span>
              </div>
              <span className="text-emerald-400 font-bold">{vpsIp || 'Loading...'}</span>
            </div>

            <div className="p-3 bg-dark-bg rounded-xl border border-gray-800 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center space-x-3">
                <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded font-bold">A</span>
                <span className="text-gray-200">www ({wwwDomain})</span>
              </div>
              <span className="text-emerald-400 font-bold">{vpsIp || 'Loading...'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNext(vpsIp || '127.0.0.1')}
          disabled={!vpsIp}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
        >
          <span>Continue to DNS Verification</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
