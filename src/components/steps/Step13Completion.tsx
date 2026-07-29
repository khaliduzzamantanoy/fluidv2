'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck, Sparkles, Copy, Key, LayoutDashboard } from 'lucide-react';

interface Step13Props {
  repoName: string;
  domain: string;
  port: number;
  sshKey?: string;
  onComplete?: () => void;
}

export default function Step13Completion({ repoName, domain, port, sshKey, onComplete }: Step13Props) {
  const [copied, setCopied] = useState(false);

  const fullDomainUrl = domain.startsWith('http') ? domain : `https://${domain}`;

  const handleCopyKey = async () => {
    if (sshKey) {
      try {
        await navigator.clipboard.writeText(sshKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard API failed:', err);
        try {
          const textArea = document.createElement('textarea');
          textArea.value = sshKey;
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
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Deployment Completed Successfully!</h2>
        <p className="text-sm text-gray-300">
          Your project is now installed, built, and running independently on this VPS.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-6">
        {/* Status Card */}
        <div className="glass-panel p-6 rounded-2xl border border-emerald-500/40 shadow-2xl shadow-emerald-500/10 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Deployment Status</span>
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping" />
              LIVE
            </span>
          </div>

          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Project:</span>
              <span className="text-white font-semibold">{repoName || 'My Application'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Domain:</span>
              <a
                href={fullDomainUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:text-brand-300 font-semibold underline inline-flex items-center space-x-1"
              >
                <span>{fullDomainUrl}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Internal Port:</span>
              <span className="text-emerald-400 font-semibold">127.0.0.1:{port}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Process Manager:</span>
              <span className="text-gray-200">PM2 Daemon (Auto-restart active)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Web Server:</span>
              <span className="text-gray-200">Nginx Reverse Proxy</span>
            </div>
          </div>
        </div>

        {/* SSH Key Display */}
        {sshKey && (
          <div className="glass-panel p-5 rounded-2xl border border-brand-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">SSH Deploy Key Generated</span>
              </div>
              <button
                onClick={handleCopyKey}
                className="flex items-center space-x-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Key</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-dark-bg/80 rounded-lg p-3 border border-gray-800">
              <code className="text-xs text-gray-300 break-all font-mono">{sshKey}</code>
            </div>
            <p className="text-xs text-gray-400">
              This SSH key has been automatically added to your GitHub repository for automated deployments.
            </p>
          </div>
        )}

        {/* Return to Dashboard */}
        <div className="p-5 bg-dark-card rounded-2xl border border-gray-800 text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-gray-300 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Your deployment is complete and saved to the Fluid portal.</span>
          </div>

          <button
            onClick={onComplete}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
