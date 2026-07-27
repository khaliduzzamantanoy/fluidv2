'use client';

import { useState } from 'react';
import { Sliders, ArrowRight, Key, Power, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Step12Props {
  selectedRepo: any;
  githubToken: string;
  onNext: (data:{sshKey?: string}) => void;
}

export default function Step12FinalSetup({ selectedRepo, githubToken, onNext }: Step12Props) {
  const [generateDeployKey, setGenerateDeployKey] = useState(true);
  const [enableAutoStart, setEnableAutoStart] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [keyDone, setKeyDone] = useState(false);
  const [sshKey, setSshKey] = useState<string | undefined>(undefined);

  const handleFinalize = async () => {
    setProcessing(true);
    if (generateDeployKey && selectedRepo) {
      try {
        const [owner, repo] = selectedRepo.fullName.split('/');
        const res = await fetch('/api/system/deploy-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo, token: githubToken })
        });
        const data = await res.json();
        if (data.success && data.publicKey) {
          setSshKey(data.publicKey);
        }
        setKeyDone(true);
      } catch (e) {}
    }
    setProcessing(false);
    onNext({ sshKey });
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Sliders className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Final Deployment Preferences</h2>
        <p className="text-sm text-gray-400">
          Review final options before concluding the deployment wizard.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-5">
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <label className="flex items-start space-x-3 p-3 bg-dark-bg/60 rounded-xl border border-gray-800 cursor-pointer hover:border-gray-700 transition">
            <input
              type="checkbox"
              checked={generateDeployKey}
              onChange={(e) => setGenerateDeployKey(e.target.checked)}
              className="mt-1 rounded border-gray-700 text-brand-500 focus:ring-brand-500"
            />
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">Generate SSH deployment key for GitHub</span>
              </div>
              <p className="text-xs text-gray-400">
                Creates a read-only SSH key pair on this VPS and registers it with your GitHub repository for automated git pulls.
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 bg-dark-bg/60 rounded-xl border border-gray-800 cursor-pointer hover:border-gray-700 transition">
            <input
              type="checkbox"
              checked={enableAutoStart}
              onChange={(e) => setEnableAutoStart(e.target.checked)}
              className="mt-1 rounded border-gray-700 text-brand-500 focus:ring-brand-500"
            />
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <Power className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Enable automatic system startup</span>
              </div>
              <p className="text-xs text-gray-400">
                Ensures PM2 and Nginx automatically boot your application if the VPS reboots.
              </p>
            </div>
          </label>
        </div>

        <button
          onClick={handleFinalize}
          disabled={processing}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
        >
          {processing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Complete Setup & Finish</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
