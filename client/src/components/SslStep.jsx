import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader2, Cloud, Lock, Info } from 'lucide-react';
import axios from 'axios';

export default function SslStep({ data, onUpdate, onNext, onPrev }) {
  const [sslProvider, setSslProvider] = useState(data.sslProvider || 'letsencrypt');
  const [sslEmail, setSslEmail] = useState(data.sslEmail || '');
  const [detecting, setDetecting] = useState(true);
  const [currentSSL, setCurrentSSL] = useState(null);
  const [error, setError] = useState('');

  const sslProviders = [
    { id: 'letsencrypt', name: "Let's Encrypt", icon: Lock, description: 'Free, automated SSL certificates', recommended: true },
    { id: 'cloudflare', name: 'Cloudflare', icon: Cloud, description: 'Managed by Cloudflare (requires Cloudflare setup)', recommended: false },
    { id: 'selfsigned', name: 'Self-Signed', icon: Shield, description: 'For development only (not trusted by browsers)', recommended: false },
  ];

  useEffect(() => {
    detectSSLProvider();
  }, [data.domain]);

  const detectSSLProvider = async () => {
    if (!data.domain) return;

    setDetecting(true);
    setError('');

    try {
      const response = await axios.post('/api/domain/detect-ssl', { domain: data.domain });
      setCurrentSSL(response.data);
      
      if (response.data.hasSSL && response.data.provider) {
        // Auto-select detected provider
        const detectedProvider = response.data.provider.toLowerCase().replace(' ', '');
        if (sslProviders.find(p => p.id === detectedProvider)) {
          setSslProvider(detectedProvider);
        }
      }
    } catch (err) {
      // Domain might not be accessible yet, that's okay
      setCurrentSSL({ hasSSL: false, provider: null });
    } finally {
      setDetecting(false);
    }
  };

  const handleNext = () => {
    if (sslProvider === 'letsencrypt' && !sslEmail) {
      setError('Email is required for Let\'s Encrypt');
      return;
    }
    
    onUpdate('sslProvider', sslProvider);
    onUpdate('sslEmail', sslEmail);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">SSL Configuration</h2>
        <p className="text-gray-400">Configure SSL for secure HTTPS access to your site.</p>
      </div>

      {/* Current SSL Status */}
      {detecting ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Detecting current SSL configuration...
        </div>
      ) : currentSSL?.hasSSL ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="font-medium text-green-400">SSL Already Configured</h3>
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-400">Provider:</span> {currentSSL.provider}</p>
            <p><span className="text-gray-400">Valid until:</span> {new Date(currentSSL.validTo).toLocaleDateString()}</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <p className="text-sm text-yellow-400">No SSL certificate detected. Please configure SSL below.</p>
          </div>
        </div>
      )}

      {/* SSL Provider Selection */}
      <div>
        <label className="block text-sm font-medium mb-3">Select SSL Provider</label>
        <div className="space-y-3">
          {sslProviders.map(provider => {
            const Icon = provider.icon;
            return (
              <button
                key={provider.id}
                onClick={() => setSslProvider(provider.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  sslProvider === provider.id
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 ${sslProvider === provider.id ? 'text-primary-400' : 'text-gray-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{provider.name}</h3>
                        {provider.recommended && (
                          <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{provider.description}</p>
                    </div>
                  </div>
                  {sslProvider === provider.id && (
                    <CheckCircle className="w-5 h-5 text-primary-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Input for Let's Encrypt */}
      {sslProvider === 'letsencrypt' && (
        <div>
          <label className="block text-sm font-medium mb-2">Email for SSL Certificate</label>
          <input
            type="email"
            value={sslEmail}
            onChange={(e) => setSslEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-field w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Required for Let's Encrypt certificate expiration notices
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary-400" />
          SSL Information
        </h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• <span className="text-white">Let's Encrypt:</span> Free, automated, trusted by all browsers</li>
          <li>• <span className="text-white">Cloudflare:</span> Use if your domain is on Cloudflare</li>
          <li>• <span className="text-white">Self-Signed:</span> Only for development/testing</li>
          <li>• SSL certificates will be auto-renewed when possible</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={sslProvider === 'letsencrypt' && !sslEmail}
          className="btn-primary flex items-center gap-2"
        >
          Next
          <Shield className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
