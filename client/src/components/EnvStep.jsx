import React, { useState } from 'react';
import { FileText, Key, Globe, Hash, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import axios from 'axios';

export default function EnvStep({ data, onUpdate, onNext, onPrev }) {
  const [envContent, setEnvContent] = useState('');
  const [parsedEnv, setParsedEnv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!envContent.trim()) {
      setParsedEnv(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/project/parse-env', { envContent });
      setParsedEnv(response.data);
      onUpdate('envVars', response.data.envVars);
    } catch (err) {
      setError('Failed to parse environment variables');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    onNext();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Environment Variables</h2>
        <p className="text-gray-400">Paste your .env file content. The system will auto-detect keys and values.</p>
      </div>

      {/* Environment Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Environment Variables (optional)
          </label>
          <textarea
            value={envContent}
            onChange={(e) => setEnvContent(e.target.value)}
            onBlur={handleParse}
            placeholder="DATABASE_URL=postgresql://user:pass@localhost:5432/db
API_KEY=your_api_key_here
SECRET_KEY=your_secret_key
PORT=3000"
            className="input-field w-full h-48 font-mono text-sm resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Paste your .env file content here. Keys and values will be auto-detected.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            Parsing environment variables...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Parsed Environment Variables */}
      {parsedEnv && parsedEnv.detected.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-400" />
              Detected Variables ({parsedEnv.detected.length})
            </h3>
            <button
              onClick={() => copyToClipboard(envContent)}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {parsedEnv.detected.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium">{item.key}</span>
                    {item.isSecret && (
                      <Key className="w-3 h-3 text-yellow-400" title="Secret/Key" />
                    )}
                    {item.isUrl && (
                      <Globe className="w-3 h-3 text-blue-400" title="URL" />
                    )}
                    {item.isNumber && (
                      <Hash className="w-3 h-3 text-green-400" title="Number" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate font-mono">
                    {item.isSecret ? '••••••••' : item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            Environment variables parsed successfully
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary-400" />
          Auto-Detection Features
        </h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• <span className="text-yellow-400">Yellow key icon</span> - Detected secret/key (password, token, etc.)</li>
          <li>• <span className="text-blue-400">Blue globe icon</span> - Detected URL</li>
          <li>• <span className="text-green-400">Green hash icon</span> - Detected numeric value</li>
          <li>• Secret values are hidden by default for security</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          className="btn-primary flex items-center gap-2"
        >
          Next
          <FileText className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
