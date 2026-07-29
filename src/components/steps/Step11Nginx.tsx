'use client';

import { useState, useEffect } from 'react';
import { Server, ArrowRight, RefreshCw, CheckCircle2, Code2, Globe, AlertCircle, SearchCheck } from 'lucide-react';
import Terminal from '../Terminal';

interface Step11Props {
  domain: string;
  wwwDomain: string;
  port: number;
  onNext: () => void;
}

export default function Step11Nginx({ domain, wwwDomain, port, onNext }: Step11Props) {
  const [config, setConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingNginx, setTestingNginx] = useState(false);
  const [nginxOk, setNginxOk] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainAccessible, setDomainAccessible] = useState(false);
  const [allowProceed, setAllowProceed] = useState(false);

  useEffect(() => {
    async function generateNginx() {
      setLoading(true);
      try {
        const res = await fetch('/api/system/nginx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, wwwDomain, port })
        });
        const data = await res.json();
        if (data.success) {
          setConfig(data.configPreview);
          if (!data.nginxInstalled) {
            setConfig(prev => `# WARNING: Nginx does not appear to be installed on this server.\n# Run: apt-get install nginx\n\n${prev || ''}`);
          }
          if (data.error) {
            setConfig(prev => `# WARNING: ${data.error}\n\n${prev || ''}`);
          }
        }
      } catch (e) {
        setConfig(`# Reverse proxy config for ${domain}\nserver {\n    listen 80;\n    server_name ${domain} ${wwwDomain};\n    location / {\n        proxy_pass http://127.0.0.1:${port};\n    }\n}`);
      } finally {
        setLoading(false);
      }
    }

    generateNginx();
  }, [domain, wwwDomain, port]);

  const reloadNginxCmd = `nginx -t && systemctl reload nginx || service nginx reload || true`;

  const checkDomainAccess = async () => {
    setCheckingDomain(true);
    try {
      const res = await fetch('/api/system/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      setDomainAccessible(data.success);
    } catch (e) {
      setDomainAccessible(false);
    } finally {
      setCheckingDomain(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Server className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Nginx Reverse Proxy Setup</h2>
        <p className="text-sm text-gray-400">
          Fluid automatically maps incoming HTTP/HTTPS traffic on <span className="text-brand-400 font-mono">{domain}</span> to <span className="text-emerald-400 font-mono">localhost:{port}</span>.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        {loading ? (
          <div className="py-12 text-center text-gray-400 space-y-3 glass-panel rounded-2xl">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400" />
            <p className="text-sm">Generating Nginx configuration file...</p>
          </div>
        ) : (
          <>
            {/* Config Preview Box */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono border-b border-gray-800 pb-2">
                <div className="flex items-center space-x-2 text-gray-300">
                  <Code2 className="w-4 h-4 text-brand-400" />
                  <span>/etc/nginx/sites-available/{domain}</span>
                </div>
                <span className="text-emerald-400">Reverse Proxy -&gt; 127.0.0.1:{port}</span>
              </div>

              <pre className="p-4 bg-[#050811] text-brand-400 font-mono text-xs rounded-xl overflow-x-auto border border-gray-800/80 leading-relaxed">
                {config}
              </pre>
            </div>

            {!testingNginx ? (
              <button
                onClick={() => setTestingNginx(true)}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
              >
                <span>Apply Nginx Config & Reload Server</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="space-y-4">
                <Terminal
                  command={reloadNginxCmd}
                  onComplete={() => setNginxOk(true)}
                />

                {nginxOk && (
                  <>
                    {/* Domain Accessibility Check */}
                    <div className="glass-panel p-4 rounded-xl border border-gray-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm">
                          <Globe className="w-4 h-4 text-brand-400" />
                          <span className="text-gray-300">Check if domain is accessible:</span>
                        </div>
                        <button
                          onClick={checkDomainAccess}
                          disabled={checkingDomain}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {checkingDomain ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <SearchCheck className="w-3.5 h-3.5" />
                          )}
                          <span>Check Domain</span>
                        </button>
                      </div>
                      
                      {domainAccessible && (
                        <div className="flex items-center space-x-2 text-xs text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Domain {domain} is accessible and responding correctly</span>
                        </div>
                      )}
                      
                      {!domainAccessible && checkingDomain === false && (
                        <div className="flex items-center space-x-2 text-xs text-amber-400">
                          <AlertCircle className="w-4 h-4" />
                          <span>Domain may not be accessible yet. Check DNS propagation and nginx status.</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={onNext}
                      className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition"
                    >
                      <span>Nginx Configured & Active — Next: Finalizing</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
