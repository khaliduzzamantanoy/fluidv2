import React, { useState, useEffect } from 'react';
import { Github, Search, Lock, Globe, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function RepoStep({ data, onUpdate, onNext, onPrev }) {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [permissions, setPermissions] = useState(['read', 'write']);

  useEffect(() => {
    fetchRepos();
  }, [data.githubToken]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = repos.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  const fetchRepos = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('/api/github/repos', {
        headers: { token: data.githubToken }
      });
      setRepos(response.data);
      setFilteredRepos(response.data);
    } catch (err) {
      setError('Failed to fetch repositories. Please check your token permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleRepoSelect = async (repo) => {
    setSelectedRepo(repo);
    onUpdate('repo', repo);
  };

  const togglePermission = (perm) => {
    const newPermissions = permissions.includes(perm)
      ? permissions.filter(p => p !== perm)
      : [...permissions, perm];
    setPermissions(newPermissions);
    onUpdate('permissions', newPermissions);
  };

  const handleNext = () => {
    if (selectedRepo) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Repository</h2>
        <p className="text-gray-400">Choose the GitHub repository you want to deploy.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search repositories..."
          className="input-field w-full pl-10"
        />
      </div>

      {/* Repository List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No repositories found
          </div>
        ) : (
          filteredRepos.map(repo => (
            <button
              key={repo.id}
              onClick={() => handleRepoSelect(repo)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedRepo?.id === repo.id
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{repo.name}</h3>
                    {repo.private ? (
                      <Lock className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Globe className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {repo.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{repo.language || 'Unknown'}</span>
                    <span>•</span>
                    <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
               {selectedRepo?.id === repo.id && (
                  <CheckCircle className="w-5 h-5 text-primary-400" />
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Permissions */}
      {selectedRepo && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="font-medium mb-3">Required Permissions</h3>
          <div className="flex gap-3">
            {['read', 'write', 'admin'].map(perm => (
              <button
                key={perm}
                onClick={() => togglePermission(perm)}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  permissions.includes(perm)
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {perm.charAt(0).toUpperCase() + perm.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedRepo}
          className="btn-primary flex items-center gap-2"
        >
          Next
          <Github className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
