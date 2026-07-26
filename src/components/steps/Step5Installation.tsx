'use client';

import { useState } from 'react';
import { Terminal as TerminalIcon, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import Terminal from '../Terminal';

interface Step5Props {
  dirPath: string;
  installCmd: string;
  buildCmd: string;
  onNext: () => void;
}

export default function Step5Installation({ dirPath, installCmd, buildCmd, onNext }: Step5Props) {
  const [phase, setPhase] = useState<'install' | 'build' | 'completed'>('install');
  const [installSuccess, setInstallSuccess] = useState(false);
  const [buildSuccess, setBuildSuccess] = useState(false);

  const fullInstallCmd = `cd ${dirPath} && ${installCmd}`;
  const fullBuildCmd = buildCmd ? `cd ${dirPath} && ${buildCmd}` : '';

  const handleInstallComplete = (success: boolean) => {
    setInstallSuccess(success);
    if (success) {
      if (buildCmd && buildCmd.trim().length > 0) {
        setPhase('build');
      } else {
        setPhase('completed');
      }
    }
  };

  const handleBuildComplete = (success: boolean) => {
    setBuildSuccess(success);
    if (success) {
      setPhase('completed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <TerminalIcon className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Installing Dependencies & Building</h2>
        <p className="text-sm text-gray-400">
          Fluid is running project installation commands live on your VPS server.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Execution Phase Tabs */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono border ${
            phase === 'install'
              ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 font-semibold'
              : installSuccess
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-dark-card text-gray-500 border-gray-800'
          }`}>
            <span>1. {installCmd}</span>
          </div>

          {buildCmd && (
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono border ${
              phase === 'build'
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 font-semibold'
                : buildSuccess
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-dark-card text-gray-500 border-gray-800'
            }`}>
              <span>2. {buildCmd}</span>
            </div>
          )}
        </div>

        {/* Live Terminal */}
        {phase === 'install' && (
          <Terminal
            command={fullInstallCmd}
            cwd={dirPath}
            onComplete={handleInstallComplete}
          />
        )}

        {phase === 'build' && (
          <Terminal
            command={fullBuildCmd}
            cwd={dirPath}
            onComplete={handleBuildComplete}
          />
        )}

        {phase === 'completed' && (
          <div className="p-6 glass-panel rounded-2xl border border-emerald-500/30 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Build & Installation Completed!</h3>
            <p className="text-sm text-gray-300">
              Dependencies are installed and project bundle has been built successfully.
            </p>
            <button
              onClick={onNext}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition inline-flex items-center space-x-2"
            >
              <span>Next: Configure Process Manager (PM2)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
