import React, { useState, useEffect } from 'react';
import { Globe, Server, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import axios from 'axios';

export default function DomainStep({ data, onUpdate, onNext, onPrev }) {
  const [domain, setDomain] = useState(data.domain || '');
  const [wwwDomain, setWwwDomain] = useState(data.wwwDomain || '');
  const [vpsIp, setVpsIp] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVpsIp();
  }, []);

  const fetchVpsIp = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/system/ip');
      setVpsIp(response.data.ip.public);
      onUpdate('vpsIp', response.data.ip.public);
    } catch (err) {
      setError('Failed to detect VPS IP address');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainChange = (value) => {
    setDomain(value);
    // Auto-generate www domain
    if (value && !value.startsWith('www.')) {
      setWwwDomain(`www.${value}`);
    } else if (value?.startsWith('www.')) {
      setWwwDomain(value);
      setDomain(value.replace('www.', ''));
    }
  };

  const handleNext = () => {
    onUpdate('domain', domain);
    onUpdate('wwwDomain', wwwDomain || '');
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Domain Configuration</h2>
        <p className="text-gray-400">Configure your domain for the deployment. VPS IP is auto-detected.</p>
      </div>

      {/* VPS IP Display */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-primary-400" />
            <div>
              <p className="text-sm text-gray-400">VPS Public IP</p>
              <p className="font-mono font-medium">
                {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : vpsIp || 'Not detected'}
              </p>
            </div>
          </div>
          {vpsIp && (
            <button
              onClick={() => navigator.clipboard.writeText(vpsIp)}
              className="text-sm text-gray-400 hover:text-white"
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Domain Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Primary Domain</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={domain}
              onChange={(e) => handleDomainChange(e.target.value)}
              placeholder="example.com"
              className="input-field w-full pl-10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            WWW Domain <span className="text-gray-500">(optional)</span>
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={wwwDomain}
              onChange={(e) => setWwwDomain(e.target.value)}
              placeholder="www.example.com"
              className="input-field w-full pl-10"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Auto-configured with primary domain. Can be skipped.
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary-400" />
          DNS Configuration
        </h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Add an A record pointing to your VPS IP: <span className="font-mono text-white">{vpsIp}</span></li>
          <li>• For www domain, add CNAME record or separate A record</li>
          <li>• DNS propagation may take up to 24 hours</li>
          <li>• We'll verify DNS configuration in the next step</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!domain}
          className="btn-primary flex items-center gap-2"
        >
          Next
          <Globe className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
