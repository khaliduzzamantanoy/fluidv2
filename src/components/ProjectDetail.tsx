'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, GitBranch, Globe, Settings, Terminal, Clock, 
  CheckCircle, AlertCircle, Loader2, Play, RotateCcw, Plus, 
  Trash2, Eye, EyeOff, Copy, ExternalLink, Key, RefreshCw,
  Server, Activity
} from 'lucide-react';

interface ProjectDetailProps {
  projectId: string | null;
  user: any;
  onNavigate: (page: any, id?: string) => void;
}

export default function ProjectDetail({ projectId, user, onNavigate }: ProjectDetailProps) {
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'env' | 'domains' | 'settings'>('overview');
  const [envVars, setEnvVars] = useState<any[]>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [showEnvValue, setShowEnvValue] = useState<Record<string, boolean>>({});
  const [deploying, setDeploying] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const [projectRes, deployRes, statsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/deployments?limit=10`),
        fetch(`/api/projects/${projectId}/stats`)
      ]);
      const pData = await projectRes.json();
      const dData = await deployRes.json();
      const sData = await statsRes.json();
      if (pData.success) setProject(pData.project);
      if (dData.success) setDeployments(dData.deployments);
      if (sData.success) setStats(sData.stats);
    } catch (err) {
      console.error('Load project error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEnvVars = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/env`);
      const data = await res.json();
      if (data.success) setEnvVars(data.envVars);
    } catch (err) {
      console.error('Load env error:', err);
    }
  };

  const deployProject = async () => {
    setDeploying(true);
    try {
      await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      setTimeout(loadProject, 2000);
    } catch (err) {
      console.error('Deploy error:', err);
    } finally {
      setDeploying(false);
    }
  };

  const addEnvVar = async () => {
    if (!newEnvKey) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newEnvKey, value: newEnvValue })
      });
      const data = await res.json();
      if (data.success) {
        setNewEnvKey('');
        setNewEnvValue('');
        loadEnvVars();
      }
    } catch (err) {
      console.error('Add env error:', err);
    }
  };

  const deleteEnvVar = async (envId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/env/${envId}`, { method: 'DELETE' });
      loadEnvVars();
    } catch (err) {
      console.error('Delete env error:', err);
    }
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setWebhookStatus('registered');
      } else {
        setWebhookStatus(data.error || 'Failed to register');
      }
    } catch (err) {
      setWebhookStatus('Network error');
    } finally {
      setRegisteringWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Project not found</p>
        <button onClick={() => onNavigate('projects')} className="text-brand-400 hover:underline mt-2 text-sm">
          Back to projects
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'deployments', label: 'Deployments', icon: Activity },
    { id: 'env', label: 'Environment', icon: Key },
    { id: 'domains', label: 'Domains', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings }
  ] as const;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => onNavigate('projects')} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <p className="text-xs text-gray-400">
              {project.repository?.fullName || 'No repository'} &middot; Port {project.port}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={deployProject}
            disabled={deploying}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50"
          >
            {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>Deploy</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-800/80 pb-0.5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'env') loadEnvVars(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition ${
              activeTab === tab.id
                ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Project Info</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Framework', project.framework],
                  ['Directory', project.directory],
                  ['Branch', project.repository?.branch],
                  ['Port', String(project.port)],
                  ['Process Manager', project.processManager],
                  ['Build', project.buildCommand || 'None'],
                  ['Start', project.startCommand],
                  ['Install', project.installCommand],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Deployment Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">{stats?.totalDeployments || 0}</p>
                    <p className="text-[10px] text-gray-500">Total</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-400">{stats?.successfulDeployments || 0}</p>
                    <p className="text-[10px] text-gray-500">Success</p>
                  </div>
                  <div className="text-center p-3 bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-400">{stats?.failedDeployments || 0}</p>
                    <p className="text-[10px] text-gray-500">Failed</p>
                  </div>
                  <div className="text-center p-3 bg-brand-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-brand-400">{stats?.domainCount || 0}</p>
                    <p className="text-[10px] text-gray-500">Domains</p>
                  </div>
                </div>
              </div>

              {project.domains?.length > 0 && (
                <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Domains</h3>
                  <div className="space-y-2">
                    {project.domains.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <Globe className="w-3.5 h-3.5 text-brand-400" />
                          <span className="text-white">{d.domain}</span>
                          {d.isPrimary && <span className="text-[10px] text-brand-400">Primary</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          d.sslStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                          d.sslStatus === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {d.sslStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'deployments' && (
          <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Deployment History</h3>
            {deployments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No deployments yet. Click Deploy to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deployments.map((dep: any) => (
                  <div key={dep.id} className="flex items-center justify-between py-3 px-3 bg-gray-800/20 rounded-lg border border-gray-800/60">
                    <div className="flex items-center space-x-3">
                      {dep.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                       dep.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-400" /> :
                       dep.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> :
                       <Clock className="w-4 h-4 text-gray-500" />}
                      <div>
                        <p className="text-xs text-white font-medium">
                          {dep.triggerMetadata?.commitMessage || dep.trigger || 'Manual'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {dep.trigger} &middot; {dep.createdAt ? new Date(dep.createdAt).toLocaleString() : 'N/A'}
                          {dep.duration ? ` &middot; ${(dep.duration / 1000).toFixed(1)}s` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      dep.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                      dep.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      dep.status === 'running' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'env' && (
          <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Environment Variables</h3>
            
            {/* Add new */}
            <div className="flex items-end space-x-2 mb-4">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 mb-1 block">Key</label>
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="MY_VARIABLE"
                  className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 mb-1 block">Value</label>
                <input
                  type="text"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="your-value"
                  className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none"
                />
              </div>
              <button onClick={addEnvVar} className="px-3 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-medium rounded-lg transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="space-y-1">
              {envVars.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No environment variables set</p>
              ) : (
                envVars.map((env: any) => (
                  <div key={env.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Key className="w-3.5 h-3.5 text-brand-400" />
                      <span className="text-xs font-mono text-white font-medium">{env.key}</span>
                      <span className="text-xs font-mono text-gray-500">
                        {env.isSecret ? '••••••••' : env.value}
                      </span>
                    </div>
                    <button onClick={() => deleteEnvVar(env.id)} className="p-1 text-gray-500 hover:text-red-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'domains' && (
          <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Domain Management</h3>
            {project.domains?.length > 0 ? (
              <div className="space-y-3">
                {project.domains.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-4 bg-gray-800/20 rounded-lg border border-gray-800/60">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-brand-400" />
                        <span className="text-sm text-white font-medium">{d.domain}</span>
                        {d.isPrimary && <span className="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded">Primary</span>}
                      </div>
                      <div className="flex items-center space-x-3 mt-1 text-[10px] text-gray-500">
                        <span>SSL: {d.sslStatus}</span>
                        <span>WWW Redirect: {d.wwwRedirect ? 'Yes' : 'No'}</span>
                        <span>DNS: {d.dnsVerified ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-xs">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No domains configured</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5 max-w-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Project Settings</h3>
            {/* Framework */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Framework</label>
              <input type="text" value={project.framework} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs focus:border-brand-500 outline-none" readOnly />
            </div>
            {/* Directory */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Directory</label>
              <input type="text" value={project.directory} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none" readOnly />
            </div>
            {/* Build commands */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Install Command</label>
                <input type="text" value={project.installCommand} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none" readOnly />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Build Command</label>
                <input type="text" value={project.buildCommand} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none" readOnly />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Start Command</label>
                <input type="text" value={project.startCommand} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none" readOnly />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Port</label>
                <input type="number" value={project.port} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs font-mono focus:border-brand-500 outline-none" readOnly />
              </div>
            </div>
            {/* Process Manager */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Process Manager</label>
              <input type="text" value={project.processManager} className="w-full px-3 py-2 bg-[#090d16] border border-gray-700 rounded-lg text-white text-xs focus:border-brand-500 outline-none" readOnly />
            </div>

            {/* Webhook / Auto-deploy */}
            <div className="pt-2 border-t border-gray-800">
              <h4 className="text-sm font-semibold text-white mb-3">Auto-Deploy (Webhook)</h4>
              <p className="text-xs text-gray-400 mb-3">
                Register a GitHub webhook so pushes to <span className="font-mono text-gray-300">{project.repository?.fullName || 'your repo'}</span> trigger automatic redeploy.
              </p>
              {project.github?.webhookId ? (
                <div className="flex items-center space-x-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Webhook registered</span>
                </div>
              ) : (
                <button
                  onClick={registerWebhook}
                  disabled={registeringWebhook}
                  className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {registeringWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{registeringWebhook ? 'Registering...' : 'Register Webhook'}</span>
                </button>
              )}
              {webhookStatus && webhookStatus !== 'registered' && (
                <p className="text-xs text-red-400 mt-2">{webhookStatus}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}