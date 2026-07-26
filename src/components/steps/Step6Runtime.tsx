'use client';

import { useState } from 'react';
import { Server, ArrowRight, ShieldCheck, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import Terminal from '../Terminal';

interface Step6Props {
  dirPath: string;
  repoName: string;
  startCmd: string;
  port: number;
  onNext: () => void;
}

export default function Step6Runtime({ dirPath, repoName, startCmd, port, onNext }: Step6Props) {
  const [started, setStarted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [portCheck, setPortCheck] = useState<{ listening: boolean; message: string } | null>(null);

  const cleanRepoName = repoName ? repoName.replace(/[^a-zA-Z0-9_-]/g, '') : 'my-app';
  
  // Format pm2 start command properly - use the detected start command
  // Redirect stderr to suppress expected error messages
  const pm2Command = `cd ${dirPath} && pm2 delete ${cleanRepoName} 2>/dev/null || true && pm2 start "${startCmd}" --name "${cleanRepoName}" && pm2 save && pm2 startup`;

  const checkPortListening = async () => {
    try {
      const res = await fetch('/api/check-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port })
      });
      const data = await res.json();
      setPortCheck({
        listening: data.inUse,
        message: data.message
      });
    } catch (err: any) {
      setPortCheck({
        listening: false,
        message: 'Could not check port status'
      });
    }
  };

  const handlePm2Complete = (isOk: boolean) => {
    setSuccess(isOk);
    if (isOk) {
      // Check if the port is actually listening after PM2 starts
      setTimeout(() => {
        checkPortListening();
      }, 3000); // Wait 3 seconds for app to start
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Server className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Runtime Setup — PM2 Process Manager</h2>
        <p className="text-sm text-gray-400">
          PM2 ensures your application runs continuously in the background and restarts automatically on server reboot.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Process Name:</span>
            <span className="text-brand-400 font-semibold">{cleanRepoName}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Target Directory:</span>
            <span className="text-gray-200">{dirPath}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Start Command:</span>
            <span className="text-emerald-400">{startCmd}</span>
          </div>
        </div>

        {!started ? (
          <button
            onClick={() => setStarted(true)}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Launch Process with PM2</span>
          </button>
        ) : (
          <div className="space-y-4">
            <Terminal
              command={pm2Command}
              cwd={dirPath}
              onComplete={handlePm2Complete}
            />

            {portCheck && (
              <div className={`p-4 rounded-xl space-y-3 ${
                portCheck.listening 
                  ? 'bg-emerald-950/40 border border-emerald-800/60' 
                  : 'bg-red-950/40 border border-red-800/60'
              }`}>
                <div className={`flex items-center space-x-2 text-sm font-semibold ${
                  portCheck.listening ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {portCheck.listening ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  <span>{portCheck.message}</span>
                </div>
                {!portCheck.listening && (
                  <p className="text-xs text-red-300">
                    The application may not have started correctly. Check the PM2 logs with: <code className="bg-red-900/50 px-1 rounded">pm2 logs {cleanRepoName}</code>
                  </p>
                )}
              </div>
            )}

            {success && portCheck?.listening && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400 text-sm font-semibold">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Process registered with PM2 Daemon & Saved to System Auto-Start!</span>
                </div>
                <button
                  onClick={onNext}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
                >
                  <span>Continue to Domain Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
