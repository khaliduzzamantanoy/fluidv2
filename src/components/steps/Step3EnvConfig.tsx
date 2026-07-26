'use client';

import { useState } from 'react';
import { FileText, Plus, Trash2, ArrowRight, CheckCircle } from 'lucide-react';

interface Step3EnvProps {
  dirPath: string;
  onNext: (data: { envVars: Record<string, string> }) => void;
}

export default function Step3EnvConfig({ dirPath, onNext }: Step3EnvProps) {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const addEnvVar = () => {
    if (newKey && newValue) {
      setEnvVars({ ...envVars, [newKey]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const removeEnvVar = (key: string) => {
    const updated = { ...envVars };
    delete updated[key];
    setEnvVars(updated);
  };

  const handleContinue = () => {
    onNext({ envVars });
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Environment Variables</h2>
        <p className="text-sm text-gray-400">
          Configure environment variables for your application. These will be saved as a .env file in your project directory.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="text-xs text-gray-400 font-mono">
            Target Directory: <span className="text-brand-400">{dirPath}</span>
          </div>

          {/* Add new env var */}
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Variable name (e.g., API_KEY)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
            />
            <input
              type="text"
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-dark-bg border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-brand-500 outline-none"
            />
            <button
              onClick={addEnvVar}
              disabled={!newKey || !newValue}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* List of env vars */}
          {Object.keys(envVars).length > 0 && (
            <div className="space-y-2 pt-2">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg border border-gray-700">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-brand-400 truncate">{key}</div>
                    <div className="text-xs font-mono text-gray-300 truncate">{value}</div>
                  </div>
                  <button
                    onClick={() => removeEnvVar(key)}
                    className="ml-2 p-2 text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {Object.keys(envVars).length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No environment variables configured yet. Add variables above or skip this step.
            </div>
          )}
        </div>

        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Continue to Directory Selection</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
