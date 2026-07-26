'use client';

import { useState } from 'react';
import { Globe, ArrowRight } from 'lucide-react';

interface Step7Props {
  onNext: (data: { domain: string; wwwDomain: string }) => void;
}

export default function Step7Domain({ onNext }: Step7Props) {
  const [domain, setDomain] = useState('');
  const [wwwDomain, setWwwDomain] = useState('');

  const handleDomainChange = (val: string) => {
    setDomain(val);
    if (val && val.includes('.')) {
      const clean = val.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!clean.startsWith('www.')) {
        setWwwDomain(`www.${clean}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const cleanWww = wwwDomain.trim() || `www.${cleanDomain}`;
    onNext({ domain: cleanDomain, wwwDomain: cleanWww });
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Globe className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Domain Setup</h2>
        <p className="text-sm text-gray-400">
          Enter your primary domain name to route Nginx and issue SSL certificates.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-5">
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-300 font-medium">Primary Domain:</label>
            <input
              type="text"
              required
              placeholder="example.com"
              value={domain}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-300 font-medium">Secondary / Subdomain (Optional):</label>
            <input
              type="text"
              placeholder="www.example.com"
              value={wwwDomain}
              onChange={(e) => setWwwDomain(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
            />
            <p className="text-[11px] text-gray-500">
              Auto-generated if left untouched.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!domain}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
        >
          <span>Continue to VPS IP Detection</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
