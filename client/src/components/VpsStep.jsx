import React, { useState } from 'react';
import { Server, Lock, Key, CheckCircle, AlertCircle, Loader2, Globe, Github } from 'lucide-react';
import axios from 'axios';

export default function VpsStep({ data, onUpdate, onNext, onPrev }) {
  const [vpsConfig, setVpsConfig] = useState({
    host: '',
    username: 'root',
    port: 22,
    authMethod: 'password', // 'password' or 'ssh-key'
    password: '',
    privateKey: ''
  });
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [vpsInfo, setVpsInfo] = useState(null);
  const [sshKeys, setSshKeys] = useState(null);
  const [githubAuthSetup, setGithubAuthSetup] = useState(false);
  const [vpsPublicKey, setVpsPublicKey] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    
    try {
      const response = await axios.post('/api/vps/test-connection', {
        host: vpsConfig.host,
        username: vpsConfig.username,
        port: vpsConfig.port,
        password: vpsConfig.authMethod === 'password' ? vpsConfig.password : undefined,
        privateKey: vpsConfig.authMethod === 'ssh-key' ? vpsConfig.privateKey : undefined
      });
      
      setConnectionStatus({ success: true, message: response.data.message });
      
      // Get VPS info
      const infoResponse = await axios.post('/api/vps/info', {
        host: vpsConfig.host,
        username: vpsConfig.username,
        port: vpsConfig.port,
        password: vpsConfig.authMethod === 'password' ? vpsConfig.password : undefined,
        privateKey: vpsConfig.authMethod === 'ssh-key' ? vpsConfig.privateKey : undefined
      });
      
      setVpsInfo(infoResponse.data);
      
      // Generate SSH keys for the VPS
      const keysResponse = await axios.post('/api/vps/generate-keys');
      setSshKeys(keysResponse.data);
      
      onUpdate('vpsConfig', vpsConfig);
      onUpdate('sshKeys', keysResponse.data);
      
    } catch (error) {
      setConnectionStatus({ success: false, message: error.response?.data?.error || error.message });
    }
    
    setTesting(false);
  };

  const setupGitHubDeviceAuth = async () => {
    try {
      const response = await axios.post('/api/vps/setup-github-auth', {
        ...vpsConfig,
        githubToken: data.githubToken,
        gitEmail: data.githubUser?.email || 'user@example.com',
        gitUsername: data.githubUser?.login || 'user'
      });
      
      setVpsPublicKey(response.data.publicKey);
      setGithubAuthSetup(true);
      
      onUpdate('vpsPublicKey', response.data.publicKey);
    } catch (error) {
      console.error('GitHub auth setup failed:', error);
    }
  };

  const handleNext = () => {
    if (connectionStatus?.success) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Connect Your VPS</h2>
        <p className="text-gray-400">
          Connect your Ubuntu VPS to deploy your project. We'll install all necessary dependencies automatically.
        </p>
      </div>

      {/* VPS Connection Form */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary-400" />
          VPS Connection Details
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">VPS IP Address / Hostname</label>
            <input
              type="text"
              value={vpsConfig.host}
              onChange={(e) => setVpsConfig({ ...vpsConfig, host: e.target.value })}
              placeholder="e.g., 123.45.67.89 or vps.example.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={vpsConfig.username}
                onChange={(e) => setVpsConfig({ ...vpsConfig, username: e.target.value })}
                placeholder="root"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">SSH Port</label>
              <input
                type="number"
                value={vpsConfig.port}
                onChange={(e) => setVpsConfig({ ...vpsConfig, port: parseInt(e.target.value) })}
                placeholder="22"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Authentication Method</label>
            <div className="flex gap-4">
              <button
                onClick={() => setVpsConfig({ ...vpsConfig, authMethod: 'password' })}
                className={`flex-1 px-4 py-3 rounded-lg border ${
                  vpsConfig.authMethod === 'password'
                    ? 'border-primary-500 bg-primary-500/20 text-primary-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                <Lock className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm">Password</span>
              </button>
              <button
                onClick={() => setVpsConfig({ ...vpsConfig, authMethod: 'ssh-key' })}
                className={`flex-1 px-4 py-3 rounded-lg border ${
                  vpsConfig.authMethod === 'ssh-key'
                    ? 'border-primary-500 bg-primary-500/20 text-primary-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                <Key className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm">SSH Key</span>
              </button>
            </div>
          </div>

          {vpsConfig.authMethod === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={vpsConfig.password}
                onChange={(e) => setVpsConfig({ ...vpsConfig, password: e.target.value })}
                placeholder="Enter VPS password"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          {vpsConfig.authMethod === 'ssh-key' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Private Key</label>
              <textarea
                value={vpsConfig.privateKey}
                onChange={(e) => setVpsConfig({ ...vpsConfig, privateKey: e.target.value })}
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 font-mono text-sm"
              />
            </div>
          )}

          <button
            onClick={testConnection}
            disabled={testing || !vpsConfig.host}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Server className="w-5 h-5" />
                Test Connection
              </>
            )}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`p-4 rounded-lg border ${
          connectionStatus.success
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus.success ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={connectionStatus.success ? 'text-green-400' : 'text-red-400'}>
              {connectionStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* VPS Info */}
      {vpsInfo && vpsInfo.success && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-400" />
            VPS Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-green-400">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">OS:</span>
              <span className="font-mono">{vpsInfo.info['uname -a']?.split(' ')[0] || 'Linux'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span className="font-mono">{vpsInfo.info['free -h']?.split('\n')[1]?.trim() || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Disk:</span>
              <span className="font-mono">{vpsInfo.info['df -h']?.split('\n')[1]?.trim() || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* SSH Keys Info */}
      {sshKeys && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="font-medium text-blue-400 mb-2">SSH Keys Generated</h4>
          <p className="text-sm text-gray-400">
            We've generated SSH keys for secure VPS access. These will be used for Git operations and secure deployments.
          </p>
        </div>
      )}

      {/* GitHub Device Auth Setup */}
      {connectionStatus?.success && !githubAuthSetup && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h4 className="font-medium text-purple-400 mb-2 flex items-center gap-2">
            <Github className="w-4 h-4" />
            GitHub Device Authentication
          </h4>
          <p className="text-sm text-gray-400 mb-3">
            Setup your VPS to authenticate directly with GitHub for secure Git operations. This is more secure than using tokens.
          </p>
          <button
            onClick={setupGitHubDeviceAuth}
            className="btn-secondary text-sm"
          >
            Setup GitHub Device Auth
          </button>
        </div>
      )}

      {/* GitHub Auth Success */}
      {githubAuthSetup && vpsPublicKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            GitHub Device Auth Configured
          </h4>
          <p className="text-sm text-gray-400 mb-2">
            Your VPS is now configured to authenticate directly with GitHub via SSH.
          </p>
          <div className="bg-gray-900 rounded p-2 text-xs font-mono break-all">
            {vpsPublicKey}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Add this SSH key to your GitHub repository's deploy keys for secure access.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!connectionStatus?.success}
          className="btn-primary"
        >
          Next
        </button>
      </div>
    </div>
  );
}
