'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Activity, Globe, CheckCircle, AlertCircle, Server, 
  ArrowUpRight, Clock, GitBranch, Plus, RefreshCw, Loader2,
  Cpu, HardDrive, Wifi, Layers, Zap, TrendingUp, Users
} from 'lucide-react';

interface DashboardHomeProps {
  user: any;
  onNavigate: (page: any, id?: string) => void;
}

export default function DashboardHome({ user, onNavigate }: DashboardHomeProps) {
  const [overview, setOverview] = useState<any>(null);
  const [serverStats, setServerStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [overviewRes, statsRes] = await Promise.all([
        fetch('/api/server/overview'),
        fetch('/api/server/stats')
      ]);
      const overviewData = await overviewRes.json();
      const statsData = await statsRes.json();
      if (overviewData.success) setOverview(overviewData.overview);
      if (statsData.success) setServerStats(statsData.stats);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-4 hover:border-gray-700/80 transition">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-bold text-white`}>{value}</p>
          {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color || 'bg-brand-500/10 text-brand-400'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-white">
          Welcome back, <span className="text-brand-400">{user?.username}</span>
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Here&apos;s what&apos;s happening with your server.</p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center space-x-3">
        <button onClick={() => onNavigate('wizard')} className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Box} label="Total Projects" value={overview?.projects?.total || 0} sub={`${overview?.projects?.active || 0} active`} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={Activity} label="Deployments" value={overview?.deployments?.total || 0} sub={`${overview?.deployments?.successRate || 0}% success`} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Globe} label="Domains" value={overview?.projects?.active || 0} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={Server} label="Server Load" value={serverStats?.cpu?.usage ? `${Math.round(serverStats.cpu.usage)}%` : 'N/A'} sub={`${serverStats?.cpu?.cores || '?'} cores`} color="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Server Health & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Server Health */}
        <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2">
            <Server className="w-4 h-4 text-brand-400" />
            <span>Server Health</span>
          </h3>
          <div className="space-y-3">
            {[
              { label: 'CPU Load', value: serverStats?.cpu?.usage ? `${Math.round(serverStats.cpu.usage)}%` : 'N/A', color: (serverStats?.cpu?.usage || 0) > 70 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Memory', value: serverStats?.memory ? `${Math.round((serverStats.memory.used / serverStats.memory.total) * 100)}%` : 'N/A' },
              { label: 'PM2 Processes', value: `${serverStats?.processes?.running || 0} running` },
              { label: 'Cores', value: `${serverStats?.cpu?.cores || '?'} cores` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className={`font-medium ${item.color || 'text-white'}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deployments */}
        <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-brand-400" />
            <span>Recent Deployments</span>
          </h3>
          {overview?.recentDeployments?.length > 0 ? (
            <div className="space-y-2">
              {overview.recentDeployments.slice(0, 5).map((dep: any) => (
                <div key={dep.id} className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0">
                  <div className="flex items-center space-x-3">
                    {dep.status === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : dep.status === 'failed' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    )}
                    <div>
                      <p className="text-xs text-white font-medium">{dep.projectId?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-500">{dep.trigger} &middot; {new Date(dep.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    dep.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                    dep.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {dep.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-xs">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No deployments yet</p>
              <button onClick={() => onNavigate('wizard')} className="text-brand-400 hover:underline mt-1">Create a project to start</button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{overview?.deployments?.successful || 0}</p>
            <p className="text-[10px] text-gray-500">Successful Deploys</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{overview?.deployments?.failed || 0}</p>
            <p className="text-[10px] text-gray-500">Failed Deploys</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{overview?.projects?.active || 0}</p>
            <p className="text-[10px] text-gray-500">Active Projects</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{overview?.recentDeployments?.length || 0}</p>
            <p className="text-[10px] text-gray-500">In Last 24h</p>
          </div>
        </div>
      </div>
    </div>
  );
}