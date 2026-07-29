'use client';

import { useState } from 'react';
import { SearchCheck, RefreshCw, CheckCircle2, XCircle, ArrowRight, AlertCircle } from 'lucide-react';

interface Step9Props {
  domain: string;
  wwwDomain: string;
  expectedIp: string;
  onNext: () => void;
}

export default function Step9DNSCheck({ domain, wwwDomain, expectedIp, onNext }: Step9Props) {
  const [checking, setChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [allowManual, setAllowManual] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  const performCheck = async () => {
    setChecking(true);
    setCheckCount(prev => prev + 1);
    try {
      const res = await fetch('/api/system/check-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, wwwDomain, expectedIp })
      });
      const data = await res.json();
      setDnsResult(data);
    } catch (e) {
      setDnsResult({
        success: false,
        results: {
          domain: { host: domain, resolved: [], matches: false },
          wwwDomain: { host: wwwDomain, resolved: [], matches: false }
        }
      });
    } finally {
      setChecking(false);
    }
  };

  const isSuccess = dnsResult?.success;
  const displayWwwDomain = wwwDomain || `www.${domain}`;
  const isWwwSameAsDomain = displayWwwDomain === domain;

  const showMatch = (result: any) => {
    if (!result) return null;
    if (result.matches) {
      return (
        <span className="flex items-center text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Points to {expectedIp}
        </span>
      );
    }
    if (result.resolved?.length > 0) {
      return (
        <span className="flex items-center text-red-400 font-semibold">
          <XCircle className="w-4 h-4 mr-1.5" />
          Points to {result.resolved.join(', ')}
        </span>
      );
    }
    return (
      <span className="flex items-center text-amber-400 font-semibold">
        <AlertCircle className="w-4 h-4 mr-1.5" />
        No DNS record found
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <SearchCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">DNS Resolution Check</h2>
        <p className="text-sm text-gray-400">
          Verify that <span className="text-brand-400 font-mono">{domain}</span> points to VPS IP <span className="text-emerald-400 font-mono">{expectedIp}</span>.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-5">
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <button
            onClick={performCheck}
            disabled={checking}
            className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
          >
            {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : <SearchCheck className="w-5 h-5" />}
            <span>{checking ? 'Checking DNS Propagation...' : checkCount > 0 ? 'Re-check DNS' : 'Check Domain DNS'}</span>
          </button>

          {dnsResult && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-dark-bg rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono">
                <span className="text-gray-300">{domain}</span>
                {showMatch(dnsResult.results?.domain)}
              </div>

              {!isWwwSameAsDomain && (
                <div className="p-3 bg-dark-bg rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300">{displayWwwDomain}</span>
                  {showMatch(dnsResult.results?.wwwDomain)}
                </div>
              )}
            </div>
          )}

          {dnsResult && (
            <div className="p-3 bg-dark-bg/50 rounded-xl border border-gray-800/50 text-[11px] text-gray-500 font-mono">
              Expected IP: {expectedIp} {dnsResult.results?.domain?.resolved?.length > 0 ? `| Resolved: ${dnsResult.results.domain.resolved.join(', ')}` : ''}
            </div>
          )}
        </div>

        {dnsResult && !isSuccess && (
          <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2 text-xs text-amber-300">
            <p className="font-semibold">
              {dnsResult.results?.domain?.resolved?.length > 0
                ? `Domain resolves to ${dnsResult.results.domain.resolved.join(', ')} but expected ${expectedIp}.`
                : 'DNS propagation can take a few minutes depending on your registrar TTL.'}
            </p>
            <p className="text-amber-400/80">Make sure you created an A record pointing <strong>{domain}</strong> to <strong>{expectedIp}</strong> at your domain registrar.</p>
            <label className="flex items-center space-x-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={allowManual}
                onChange={(e) => setAllowManual(e.target.checked)}
                className="rounded border-amber-700 text-amber-500"
              />
              <span>I confirm DNS is configured, proceed anyway</span>
            </label>
          </div>
        )}

        <button
          onClick={onNext}
          disabled={!isSuccess && !allowManual}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
        >
          <span>Continue to SSL Setup</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
