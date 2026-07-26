'use client';

import { useState } from 'react';
import { Shield, Check, ArrowRight, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import Terminal from '../Terminal';

interface Step10Props {
  domain: string;
  wwwDomain: string;
  onNext: (sslConfig: any) => void;
}

export default function Step10SSL({ domain, wwwDomain, onNext }: Step10Props) {
  const [selectedOption, setSelectedOption] = useState<number>(1);
  const [email, setEmail] = useState('admin@' + domain);
  const [runningCertbot, setRunningCertbot] = useState(false);
  const [certbotSuccess, setCertbotSuccess] = useState(false);

  const certbotCmd = `certbot --nginx -d ${domain} -d ${wwwDomain} --non-interactive --agree-tos -m ${email} || true`;

  const options = [
    {
      id: 1,
      title: "Let's Encrypt (Recommended)",
      desc: "Free automated SSL certificate via Certbot with auto-renewal.",
      badge: "Automated"
    },
    {
      id: 2,
      title: "Existing Certificate",
      desc: "Use pre-existing SSL certificate installed on server.",
      badge: "Manual"
    },
    {
      id: 3,
      title: "Custom Certificate",
      desc: "Provide custom certificate (.crt) & private key (.key) paths.",
      badge: "Custom"
    },
    {
      id: 4,
      title: "Cloudflare Managed SSL",
      desc: "SSL handled by Cloudflare proxy (Full / Flexible SSL mode).",
      badge: "Cloudflare"
    },
    {
      id: 5,
      title: "Skip SSL",
      desc: "Deploy over HTTP standard port 80 only.",
      badge: "HTTP Only"
    }
  ];

  const handleContinue = () => {
    if (selectedOption === 1 && !certbotSuccess) {
      setRunningCertbot(true);
    } else {
      onNext({ mode: selectedOption, email });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">SSL / HTTPS Configuration</h2>
        <p className="text-sm text-gray-400">
          Choose how to secure traffic to <span className="text-brand-400 font-mono">{domain}</span>.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Option Selection List */}
        {!runningCertbot && (
          <div className="space-y-3">
            {options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/60 shadow-lg shadow-brand-500/10'
                      : 'bg-dark-card/80 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-white">{opt.title}</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-brand-500/20 text-brand-400">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'bg-brand-500 border-brand-400 text-white' : 'border-gray-700'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}

            {/* Email input for Let's Encrypt */}
            {selectedOption === 1 && (
              <div className="p-4 glass-panel rounded-xl border border-brand-500/30 space-y-2">
                <label className="text-xs text-gray-300 font-mono">Let's Encrypt Email Address:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-gray-700 rounded-lg text-white font-mono text-xs focus:border-brand-500 outline-none"
                />
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
            >
              <span>{selectedOption === 1 ? "Execute Let's Encrypt Certbot" : "Continue to Nginx Configuration"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Certbot Terminal Runner */}
        {runningCertbot && (
          <div className="space-y-4">
            <Terminal
              command={certbotCmd}
              onComplete={(isOk) => setCertbotSuccess(true)}
            />

            {certbotSuccess && (
              <button
                onClick={() => onNext({ mode: 1, email })}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition"
              >
                <span>SSL Issued — Next: Configure Nginx</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
