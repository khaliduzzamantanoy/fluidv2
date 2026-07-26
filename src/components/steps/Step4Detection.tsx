'use client';

import { useState, useEffect } from 'react';
import { Cpu, RefreshCw, ArrowRight, Settings, CheckCircle2, Terminal as TerminalIcon, AlertTriangle } from 'lucide-react';

interface Step4Props {
  dirPath: string;
  onNext: (data: { detection: any; installCmd: string; buildCmd: string; startCmd: string; port: number }) => void;
}

export default function Step4Detection({ dirPath, onNext }: Step4Props) {
  const [loading, setLoading] = useState(true);
  const [detection, setDetection] = useState<any>(null);
  const [installCmd, setInstallCmd] = useState('npm install');
  const [buildCmd, setBuildCmd] = useState('npm run build');
  const [startCmd, setStartCmd] = useState('npm start');
  const [port, setPort] = useState<number>(3000);
  const [error, setError] = useState<string | null>(null);
  const [portCheck, setPortCheck] = useState<{ inUse: boolean; message: string } | null>(null);
  const [checkingPort, setCheckingPort] = useState(false);

  useEffect(() => {
    async function analyzeProject() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/deploy/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath })
        });
        const data = await res.json();
        if (data.success && data.detection) {
          const d = data.detection;
          setDetection(d);
          setInstallCmd(d.installCmd || 'npm install');
          setBuildCmd(d.buildCmd || '');
          setStartCmd(d.startCmd || 'npm start');
          setPort(d.port || 3000);
        } else {
          setError(data.error || 'Failed to detect project configuration');
        }
      } catch (err: any) {
        setError(err.message || 'Error analyzing project');
      } finally {
        setLoading(false);
      }
    }

    if (dirPath) {
      analyzeProject();
    }
  }, [dirPath]);

  const checkPortAvailability = async (portToCheck: number) => {
    setCheckingPort(true);
    setPortCheck(null);
    try {
      const res = await fetch('/api/check-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: portToCheck })
      });
      const data = await res.json();
      setPortCheck({
        inUse: data.inUse,
        message: data.message
      });
    } catch (err: any) {
      setPortCheck({
        inUse: false,
        message: 'Could not check port availability'
      });
    } finally {
      setCheckingPort(false);
    }
  };

  useEffect(() => {
    if (port > 0) {
      checkPortAvailability(port);
    }
  }, [port]);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Cpu className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Project Analysis & Auto-Detection</h2>
        <p className="text-sm text-gray-400">
          Fluid scanned repository files to determine the runtime, framework, and build settings.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        {loading ? (
          <div className="py-12 text-center text-gray-400 space-y-3 glass-panel rounded-2xl">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400" />
            <p className="text-sm">Analyzing repository structure...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        ) : (
          <>
            {/* Detected Framework Banner */}
            <div className="glass-panel p-5 rounded-2xl border border-brand-500/30 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-mono">Detected Stack</span>
                <div className="flex items-center space-x-3">
                  <span className="text-xl font-bold text-white">{detection?.framework || 'Generic App'}</span>
                  <span className="px-2.5 py-0.5 text-xs font-mono rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    {detection?.type || 'Node.js'}
                  </span>
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Editable Configuration Fields */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-semibold text-white pb-1 border-b border-gray-800">
                <Settings className="w-4 h-4 text-brand-400" />
                <span>Build & Runtime Configuration</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-mono">Install Command:</label>
                  <input
                    type="text"
                    value={installCmd}
                    onChange={(e) => setInstallCmd(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-mono">Build Command:</label>
                  <input
                    type="text"
                    value={buildCmd}
                    onChange={(e) => setBuildCmd(e.target.value)}
                    placeholder="e.g. npm run build (or leave empty)"
                    className="w-full px-3 py-2 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-mono">Start Command:</label>
                  <input
                    type="text"
                    value={startCmd}
                    onChange={(e) => setStartCmd(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-mono">Target App Port:</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="flex-1 px-3 py-2 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
                    />
                    <button
                      onClick={() => checkPortAvailability(port)}
                      disabled={checkingPort}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {checkingPort ? 'Checking...' : 'Check'}
                    </button>
                  </div>
                  {portCheck && (
                    <div className={`mt-1 text-xs ${portCheck.inUse ? 'text-red-400' : 'text-emerald-400'}`}>
                      {portCheck.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {portCheck && portCheck.inUse && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center space-x-2 text-red-300 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Port {port} is already in use. Please choose a different port or stop the conflicting process.
                </span>
              </div>
            )}

            <button
              onClick={() => onNext({ detection, installCmd, buildCmd, startCmd, port })}
              disabled={portCheck?.inUse}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Save & Start Installation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
