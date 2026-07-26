'use client';

import { useState, useEffect } from 'react';
import { Search, Lock, Globe, GitBranch, ArrowRight, RefreshCw, FolderGit2 } from 'lucide-react';

interface Step2Props {
  githubToken: string;
  onNext: (data: { selectedRepo: any; branch: string }) => void;
}

export default function Step2RepoSelect({ githubToken, onNext }: Step2Props) {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>(['main']);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRepos() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/github/repos', {
          headers: { Authorization: `Bearer ${githubToken}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.repos)) {
          setRepos(data.repos);
        } else {
          setError(data.error || 'Failed to load GitHub repositories');
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching repos');
      } finally {
        setLoading(false);
      }
    }

    if (githubToken) {
      fetchRepos();
    }
  }, [githubToken]);

  const handleSelectRepo = async (repo: any) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.defaultBranch || 'main');
    setLoadingBranches(true);

    try {
      const [owner, repoName] = repo.fullName.split('/');
      const res = await fetch(`/api/github/branches?owner=${owner}&repo=${repoName}`, {
        headers: { Authorization: `Bearer ${githubToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.branches) && data.branches.length > 0) {
        setBranches(data.branches);
        if (!data.branches.includes(selectedBranch)) {
          setSelectedBranch(data.branches[0]);
        }
      }
    } catch (e) {
      // Fallback
    } finally {
      setLoadingBranches(false);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
          <FolderGit2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Select Repository & Branch</h2>
        <p className="text-sm text-gray-400">
          Choose the GitHub repository you want to deploy onto this VPS.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-dark-card border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-brand-500 outline-none text-sm"
          />
        </div>

        {/* Repos List */}
        {loading ? (
          <div className="py-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400" />
            <p className="text-xs">Fetching repositories from GitHub...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {filteredRepos.map((repo) => {
              const isSelected = selectedRepo?.id === repo.id;
              return (
                <div
                  key={repo.id}
                  onClick={() => handleSelectRepo(repo)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/60 shadow-lg shadow-brand-500/10'
                      : 'bg-dark-card/80 border-gray-800 hover:border-gray-700 hover:bg-dark-card'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-white">{repo.fullName}</span>
                      {repo.private ? (
                        <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Lock className="w-3 h-3 mr-1" /> Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Globe className="w-3 h-3 mr-1" /> Public
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-gray-400 line-clamp-1">{repo.description}</p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 font-mono">
                    Default: {repo.defaultBranch || 'main'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Repo Branch Config */}
        {selectedRepo && (
          <div className="p-4 glass-panel rounded-xl border border-brand-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Selected Repository:</span>
              <span className="text-sm font-semibold text-brand-400">{selectedRepo.fullName}</span>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <GitBranch className="w-4 h-4 text-brand-400" />
              <span className="text-xs text-gray-300 font-medium">Select Branch:</span>
              {loadingBranches ? (
                <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-dark-bg border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNext({ selectedRepo, branch: selectedBranch })}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl shadow-lg transition"
              >
                <span>Continue to Target Directory</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
