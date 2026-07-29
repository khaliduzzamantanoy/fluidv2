'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, RefreshCw, CheckCircle, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react';

interface DomainPageProps {
  user: any;
}

export default function DomainPage({ user }: DomainPageProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) setProjects(data.projects.filter((p: any) => p.domains?.length > 0));
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );
  }

  const allDomains = projects.flatMap((p: any) =>
    (p.domains || []).map((d: any) => ({ ...d, projectName: p.name, projectId: p.id }))
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-white">Domains</h1>
        <p className="text-sm text-gray-400">Manage domains and SSL certificates across all projects</p>
      </div>

      {allDomains.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No domains configured yet</p>
          <p className="text-xs text-gray-600 mt-1">Add a domain to a project to get started</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {allDomains.map((d: any) => (
            <div key={d.id} className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{d.domain}</h3>
                    <p className="text-[10px] text-gray-500">
                      {d.projectName} {d.isPrimary && '· Primary'} · DNS: {d.dnsVerified ? '✓ Verified' : '✗ Pending'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-1 rounded font-mono ${
                    d.sslStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                    d.sslStatus === 'failed' ? 'bg-red-500/10 text-red-400' :
                    d.sslStatus === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {d.sslStatus || 'none'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}