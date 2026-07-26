'use client';

import { useState, useEffect } from 'react';
import { Folder, ArrowRight, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import Terminal from '../Terminal';

interface Step3Props {
  selectedRepo: any;
  branch: string;
  githubToken: string;
  onNext: (data: { dirPath: string }) => void;
}

export default function Step3DirSelect({ selectedRepo, branch, githubToken, onNext }: Step3Props) {
  const defaultPath = `/var/www/${selectedRepo?.name || 'my-project'}`;
  const [dirPath, setDirPath] = useState(defaultPath);
  const [dirStatus, setDirStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneDone, setCloneDone] = useState(false);

  const checkDirectory = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/system/check-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath })
      });
      const data = await res.json();
      setDirStatus(data);
      if (!data.exists || data.isEmpty) {
        setPermissionGranted(true);
      } else {
        setPermissionGranted(false);
      }
    } catch (e) {
      setDirStatus({ exists: false, isEmpty: true });
      setPermissionGranted(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkDirectory();
  }, [dirPath]);

  // Construct clone command using GitHub token — no credential prompts, streamed progress
  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${selectedRepo?.fullName}.git`;
  const cloneCommand = [
    `mkdir -p ${dirPath}`,
    `GIT_TERMINAL_PROMPT=0 git clone --progress -b ${branch} ${cloneUrl} ${dirPath} 2>&1`,
  ].join(' && ');

  const handleStartClone = () => {
    setCloning(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Folder className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Project Directory & Git Clone</h2>
        <p className="text-sm text-gray-400">
          Specify where on the VPS server to install <span className="text-brand-400 font-mono">{selectedRepo?.fullName}</span>.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <label className="text-xs text-gray-300 font-mono font-medium block">
            Target VPS Path:
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={dirPath}
              disabled={cloning}
              onChange={(e) => setDirPath(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none disabled:opacity-50"
            />
            <button
              onClick={checkDirectory}
              disabled={checking || cloning}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition"
            >
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Re-check'}
            </button>
          </div>

          {dirStatus && (
            <div className="pt-1">
              {dirStatus.exists && !dirStatus.isEmpty ? (
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start space-x-3 text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Directory exists and is not empty.</p>
                    <p className="text-amber-400/80">Cloning may overwrite or merge files in this directory.</p>
                    <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionGranted}
                        onChange={(e) => setPermissionGranted(e.target.checked)}
                        className="rounded border-amber-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="font-medium text-amber-200">I grant permission to clone into this directory</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center space-x-2 text-emerald-400 text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>Path is valid and ready for installation.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {!cloning && (
          <button
            onClick={handleStartClone}
            disabled={!permissionGranted}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
          >
            <span>Start Git Clone</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {cloning && (
          <div className="space-y-4">
            <Terminal
              command={cloneCommand}
              onComplete={(success) => setCloneDone(success)}
            />

            {cloneDone && (
              <button
                onClick={() => onNext({ dirPath })}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition"
              >
                <span>Clone Completed — Next: Analyze Project</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
