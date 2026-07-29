'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Loader2, Clock, Settings as SettingsIcon, User, Shield, AlertCircle } from 'lucide-react';

interface ActivityPageProps {
  user: any;
}

export default function ActivityPage({ user }: ActivityPageProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadActivities(); }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/activity?category=${filter}` : '/api/activity';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setActivities(data.activities);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (category: string) => {
    switch (category) {
      case 'project': return '📦';
      case 'deployment': return '🚀';
      case 'domain': return '🌐';
      case 'env': return '🔑';
      case 'auth': return '🔐';
      case 'security': return '🛡️';
      case 'system': return '⚙️';
      default: return '📋';
    }
  };

  const categories = ['', 'project', 'deployment', 'domain', 'env', 'auth', 'security', 'system'];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Activity Log</h1>
          <p className="text-sm text-gray-400">Track all changes and events</p>
        </div>
        <button onClick={loadActivities} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="flex space-x-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setFilter(cat); }}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition ${
              filter === cat ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'bg-gray-800/30 text-gray-400 hover:text-white'
            }`}
          >
            {cat || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-start space-x-3 py-3 px-4 bg-[#0c1222] border border-gray-800/60 rounded-lg">
              <span className="text-lg">{getActionIcon(a.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white">{a.description}</p>
                <div className="flex items-center space-x-2 text-[10px] text-gray-500 mt-0.5">
                  <span className="capitalize">{a.category}</span>
                  {a.projectId?.name && (
                    <>
                      <span>·</span>
                      <span>{a.projectId.name}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{a.createdAt ? new Date(a.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}