import React, { useState } from 'react';
import { Globe, CheckCircle, AlertCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import axios from 'axios';

export default function DnsStep({ data, onUpdate, onNext, onPrev }) {
  const [checking, setChecking] = useState(false);
  const [dnsStatus, setDnsStatus] = useState(null);
  const [propagationStatus, setPropagationStatus] = useState(null);
  const [error, setError] = useState('');

  const checkDNS = async () => {
    setChecking(true);
    setError('');
    setDnsStatus(null);
    setPropagationStatus(null);

    try {
      // Check primary domain
      const primaryResponse = await axios.post('/api/domain/check-dns', {
        domain: data.domain,
        expectedIP: data.vpsIp
      });

      setDnsStatus(primaryResponse.data);

      // Check propagation if primary is pointed
      if (primaryResponse.data.isPointed) {
        const propagationResponse = await axios.post('/api/domain/check-propagation', {
          domain: data.domain,
          expectedIP: data.vpsIp
        });
        setPropagationStatus(propagationResponse.data);
      }
    } catch (err) {
      setError('Failed to check DNS records');
    } finally {
      setChecking(false);
    }
  };

  const handleNext = () => {
    if (dnsStatus?.isPointed) {
      onNext();
    } else {
      setError('Please wait for DNS to propagate before continuing');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">DNS Verification</h2>
        <p className="text-gray-400">Verify that your domain is correctly pointing to this VPS.</p>
      </div>

      {/* DNS Info */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Domain</p>
            <p className="font-mono font-medium">{data.domain}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Expected IP</p>
            <p className="font-mono font-medium">{data.vpsIp}</p>
          </div>
        </div>
      </div>

      {/* Check Button */}
      <button
        onClick={checkDNS}
        disabled={checking}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
        {checking ? 'Checking DNS...' : 'Check DNS Records'}
      </button>

      {/* DNS Status */}
      {dnsStatus && (
        <div className={`rounded-lg p-4 border ${
          dnsStatus.isPointed 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {dnsStatus.isPointed ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            )}
            <h3 className="font-medium">
              {dnsStatus.isPointed ? 'DNS Correctly Configured' : 'DNS Not Pointed Yet'}
            </h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Records:</span>
              <span className="font-mono">
                {dnsStatus.records.length > 0 ? dnsStatus.records.join(', ') : 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expected IP:</span>
              <span className="font-mono">{dnsStatus.expectedIP}</span>
            </div>
          </div>
        </div>
      )}

      {/* Propagation Status */}
      {propagationStatus && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-400" />
            DNS Propagation Status
          </h3>
          <div className="space-y-2">
            {propagationStatus.results.map((result, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{result.server}</span>
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm">
            <span className="text-gray-400">Status: </span>
            <span className={propagationStatus.propagated ? 'text-green-400' : 'text-yellow-400'}>
              {propagationStatus.propagated ? 'Fully Propagated' : 'Still Propagating'}
            </span>
          </div>
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
          DNS Configuration Help
        </h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Log into your domain registrar (GoDaddy, Namecheap, etc.)</li>
          <li>• Find DNS settings for {data.domain}</li>
          <li>• Add A record: <span className="font-mono">@ → {data.vpsIp}</span></li>
          <li>• For www: Add CNAME <span className="font-mono">www → {data.domain}</span> or A record</li>
          <li>• Save changes and wait for propagation (can take 5-30 minutes)</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!dnsStatus?.isPointed}
          className="btn-primary flex items-center gap-2"
        >
          Next
          <CheckCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
