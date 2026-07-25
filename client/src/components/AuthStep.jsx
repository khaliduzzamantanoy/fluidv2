import React, { useState } from 'react';
import { Github, Key, Monitor, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function AuthStep({ data, onUpdate, onNext }) {
  const [authMethod, setAuthMethod] = useState('token');
  const [token, setToken] = useState('');
  const [deviceCode, setDeviceCode] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const handleTokenAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/token', { token });
      if (response.data.success) {
        setUser(response.data.user);
        onUpdate('githubToken', token);
        onUpdate('githubUser', response.data.user);
        onNext();
      }
    } catch (err) {
      setError('Invalid GitHub token. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const initiateDeviceFlow = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/device/initiate');
      if (response.data.success) {
        setDeviceCode(response.data.deviceCode);
        setUserCode(response.data.userCode);
        setVerificationUri(response.data.verificationUri);
        
        // Start polling
        pollDeviceFlow(response.data.deviceCode, response.data.interval);
      }
    } catch (err) {
      setError('Failed to initiate device flow. Please try again.');
      setLoading(false);
    }
  };

  const pollDeviceFlow = async (deviceCode, interval) => {
    try {
      const response = await axios.post('/api/auth/device/poll', { deviceCode, interval });
      if (response.data.success) {
        setUser(response.data.user);
        onUpdate('githubToken', response.data.token);
        onUpdate('githubUser', response.data.user);
        setLoading(false);
        onNext();
      }
    } catch (err) {
      if (err.response?.data?.error !== 'authorization_pending') {
        setError('Device flow failed. Please try again.');
        setLoading(false);
      } else {
        // Continue polling
        setTimeout(() => pollDeviceFlow(deviceCode, interval), interval * 1000);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">GitHub Authentication</h2>
        <p className="text-gray-400">Choose your preferred authentication method to connect your GitHub account.</p>
      </div>

      {/* Auth Method Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setAuthMethod('token')}
          className={`p-6 rounded-xl border-2 transition-all ${
            authMethod === 'token' 
              ? 'border-primary-500 bg-primary-500/10' 
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Key className="w-8 h-8 mb-3 mx-auto text-primary-400" />
          <h3 className="font-semibold mb-1">Personal Access Token</h3>
          <p className="text-sm text-gray-400">Use your GitHub personal access token</p>
        </button>

        <button
          onClick={() => setAuthMethod('device')}
          className={`p-6 rounded-xl border-2 transition-all ${
            authMethod === 'device' 
              ? 'border-primary-500 bg-primary-500/10' 
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Monitor className="w-8 h-8 mb-3 mx-auto text-primary-400" />
          <h3 className="font-semibold mb-1">Device Code</h3>
          <p className="text-sm text-gray-400">Authenticate on another device</p>
        </button>
      </div>

      {/* Token Auth Form */}
      {authMethod === 'token' && (
        <form onSubmit={handleTokenAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">GitHub Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="input-field w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Token needs 'repo' and 'user' permissions
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
            {loading ? 'Verifying...' : 'Connect with GitHub'}
          </button>
        </form>
      )}

      {/* Device Code Flow */}
      {authMethod === 'device' && (
        <div className="space-y-4">
          {!deviceCode ? (
            <button
              onClick={initiateDeviceFlow}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
              {loading ? 'Initializing...' : 'Start Device Flow'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-400 mb-2">Enter this code on GitHub:</p>
                <div className="text-4xl font-mono font-bold tracking-wider text-primary-400 mb-4">
                  {userCode}
                </div>
                <a
                  href={verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline"
                >
                  {verificationUri}
                </a>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for authorization...
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Info Display */}
      {user && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="font-medium text-green-400">Authenticated as {user.login}</p>
            <p className="text-sm text-gray-400">{user.name || user.login}</p>
          </div>
        </div>
      )}
    </div>
  );
}
