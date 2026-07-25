import React, { useState, useEffect } from 'react';
import { CheckCircle, Globe, Server, ExternalLink, Copy, Shield, Key, X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function CompleteStep({ data }) {
  const [sshKey, setSshKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupComplete, setCleanupComplete] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupSafe, setCleanupSafe] = useState(null);

  useEffect(() => {
    generateSSHKey();
    checkCleanupSafety();
  }, []);

  const generateSSHKey = async () => {
    try {
      const response = await axios.post('/api/project/ssh-key', {
        email: data.githubUser?.email || 'user@example.com'
      });
      setSshKey(response.data);
    } catch (err) {
      console.error('Failed to generate SSH key');
    }
  };

  const checkCleanupSafety = async () => {
    try {
      const response = await axios.get('/api/cleanup/check-cleanup-safe');
      setCleanupSafe(response.data);
    } catch (err) {
      console.error('Failed to check cleanup safety');
    }
  };

  const performCleanup = async () => {
    setCleaningUp(true);
    try {
      const response = await axios.post('/api/cleanup', { confirm: true });
      setCleanupComplete(true);
      setCleaningUp(false);
    } catch (err) {
      console.error('Cleanup failed:', err);
      setCleaningUp(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Deployment Complete!</h2>
        <p className="text-gray-400">Your server is ready and your website is live.</p>
      </div>

      {/* Success Summary */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2 text-green-400">
          <CheckCircle className="w-5 h-5" />
          Deployment Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Repository:</span>
            <span className="font-medium">{data.repo?.full_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Domain:</span>
            <span className="font-medium">{data.domain}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Project Directory:</span>
            <span className="font-mono text-sm">{data.projectDir}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">SSL Provider:</span>
            <span className="font-medium capitalize">{data.sslProvider}</span>
          </div>
        </div>
      </div>

      {/* Access Links */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          Access Your Website
        </h3>
        <div className="space-y-3">
          <a
            href={`https://${data.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary-400" />
              <div>
                <p className="font-medium">https://{data.domain}</p>
                <p className="text-sm text-gray-400">Primary domain</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
          </a>

          {data.wwwDomain && (
            <a
              href={`https://${data.wwwDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary-400" />
                <div>
                  <p className="font-medium">https://{data.wwwDomain}</p>
                  <p className="text-sm text-gray-400">WWW domain</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </a>
          )}
        </div>
      </div>

      {/* SSH Key for GitHub Access */}
      {sshKey && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-400" />
            SSH Key for GitHub VPS Access
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            Add this public key to your GitHub repository's deploy keys for secure access:
          </p>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm break-all relative">
            <button
              onClick={() => copyToClipboard(sshKey.publicKey)}
              className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              title="Copy SSH key"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
            <span className="text-green-400">{sshKey.publicKey}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Go to GitHub repo → Settings → Deploy Keys → Add deploy key
          </p>
        </div>
      )}

      {/* Important Information */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          Important Information
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <Server className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Your application is running in the background via PM2</span>
          </li>
          <li className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>SSL certificate is auto-configured and will auto-renew</span>
          </li>
          <li className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Nginx is configured as a reverse proxy</span>
          </li>
          <li className="flex items-start gap-2">
            <X className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <span>You can safely exit this VPS - everything will continue running</span>
          </li>
        </ul>
      </div>

      {/* Next Steps */}
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-6">
        <h3 className="font-medium mb-3 text-primary-400">Next Steps</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Visit your website to verify it's working</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Set up GitHub deploy keys for easy updates</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Configure monitoring and logging as needed</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>Set up backup strategy for your data</span>
          </li>
        </ul>
      </div>

      {/* Auto-Cleanup Section */}
      {!cleanupComplete ? (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <h3 className="font-medium mb-3 flex items-center gap-2 text-yellow-400">
            <Trash2 className="w-5 h-5" />
            Auto-Cleanup Installer
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            The Fluid installer can automatically remove itself from your VPS to keep your system clean. 
            Your deployed application will continue running normally.
          </p>
          
          {cleanupSafe && (
            <div className={`mb-4 p-3 rounded-lg ${
              cleanupSafe.safe ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 text-sm">
                {cleanupSafe.safe ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>{cleanupSafe.message}</span>
              </div>
            </div>
          )}
          
          {!showCleanupConfirm ? (
            <button
              onClick={() => setShowCleanupConfirm(true)}
              disabled={cleaningUp}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Remove Installer from VPS
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span>This will permanently remove the Fluid installer from your VPS.</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCleanupConfirm(false)}
                  disabled={cleaningUp}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={performCleanup}
                  disabled={cleaningUp}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {cleaningUp ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Confirm Removal
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="font-medium text-green-400">Installer Removed Successfully</h3>
          </div>
          <p className="text-sm text-gray-400">
            The Fluid installer has been completely removed from your VPS. Your deployed application 
            continues to run in the background via PM2. You can now safely close this page.
          </p>
        </div>
      )}

      {/* Close Button */}
      <div className="text-center">
        <button
          onClick={() => window.close()}
          className="btn-primary px-8 py-3 text-lg"
        >
          Close Installer
        </button>
        <p className="text-sm text-gray-500 mt-2">
          Your server will continue running in the background
        </p>
      </div>
    </div>
  );
}
