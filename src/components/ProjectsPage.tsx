'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Plus, Search, GitBranch, Globe, Clock, ArrowRight, 
  CheckCircle, AlertCircle, Loader2, ExternalLink, Settings,
  MoreHorizontal, Trash2, RefreshCw, FolderGit2, Lock
} from 'lucide-react';

interface ProjectsPageProps {
  user: any;
  onNavigate: (page: any, id?: string) => void;
}

export default function ProjectsPage({ user, onNavigate }: ProjectsPageProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) setProjects(data.projects);
    } catch (err) {
      console.error('Load projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      loadProjects();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.repository?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400';
      case 'deploying': case 'building': return 'bg-amber-500/10 text-amber-400';
      case 'error': return 'bg-red-500/10 text-red-400';
      case 'archived': return 'bg-gray-500/10 text-gray-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getFrameworkIcon = (fw: string) => {
    const icons: Record<string, string> = {
      nextjs: 'Next', vite: 'Vite', react: 'React', express: 'Exp',
      django: 'Dj', flask: 'Flask', laravel: 'Lv', docker: 'Dk', static: 'St', custom: 'Cu'
    };
    return icons[fw] || 'Cu';
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Projects</h1>
          <p className="text-sm text-gray-400">Manage your deployed applications</p>
        </div>
        <button onClick={() => onNavigate('dashboard')} className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#0c1222] border border-gray-800 rounded-xl text-white text-sm placeholder-gray-500 focus:border-brand-500 outline-none transition"
        />
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FolderGit2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No projects found</p>
          {search && <p className="text-xs text-gray-600 mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((project) => (
            <div
              key={project._id}
              className="bg-[#0c1222] border border-gray-800/80 rounded-xl p-4 hover:border-gray-700/80 transition group cursor-pointer"
              onClick={() => onNavigate('project-detail', project._id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/20 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                    {getFrameworkIcon(project.framework)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] text-gray-500 mt-0.5">
                      {project.repository?.fullName && (
                        <span className="flex items-center space-x-1">
                          <GitBranch className="w-3 h-3" />
                          <span>{project.repository.fullName}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Globe className="w-3 h-3" />
                        <span>Port {project.port}</span>
                      </span>
                      {project.domains?.length > 0 && (
                        <span className="flex items-center space-x-1 text-brand-400">
                          <span>{project.domains.length} domain{project.domains.length > 1 ? 's' : ''}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); onNavigate('project-detail', project._id); }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(project._id); }}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}