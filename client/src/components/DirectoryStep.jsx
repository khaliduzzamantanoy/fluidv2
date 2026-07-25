import React, { useState, useEffect } from 'react';
import { FolderOpen, FolderPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function DirectoryStep({ data, onUpdate, onNext, onPrev }) {
  const [projectDir, setProjectDir] = useState(data.projectDir || '/var/www/fluid');
  const [exists, setExists] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkDirectory();
  }, [projectDir]);

  const checkDirectory = async () => {
    if (!projectDir) {
      setExists(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // This would check if directory exists on the server
      // For now, we'll simulate it
      setExists(false); // Assume it doesn't exist for demo
    } catch (err) {
      setError('Failed to check directory');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/project/directory', { path: projectDir });
      onUpdate('projectDir', projectDir);
      onNext();
    } catch (err) {
      setError('Failed to create directory. Please check the path and permissions.');
    } finally {
      setLoading(false);
    }
  };

  const commonDirs = [
    '/var/www/fluid',
    '/home/ubuntu/projects',
    '/opt/fluid',
    '/var/www/html'
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Project Directory</h2>
        <p className="text-gray-400">Specify where your project should be installed on the VPS.</p>
      </div>

      {/* Directory Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Project Directory Path</label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={projectDir}
              onChange={(e) => setProjectDir(e.target.value)}
              placeholder="/var/www/fluid"
              className="input-field w-full pl-10"
            />
          </div>
        </div>

        {/* Common Directories */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Common directories:</p>
          <div className="flex flex-wrap gap-2">
            {commonDirs.map(dir => (
              <button
                key={dir}
                onClick={() => setProjectDir(dir)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Status */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking directory...
          </div>
        )}

        {exists !== null && !loading && (
          <div className={`flex items-center gap-2 text-sm ${
            exists ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {exists ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Directory already exists - will be overwritten
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Directory will be created
              </>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-primary-400" />
          Directory Information
        </h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Directory will be created if it doesn't exist</li>
          <li>• Parent directories will be created automatically</li>
          <li>• Make sure the user has write permissions</li>
          <li>• Recommended: /var/www for web applications</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={loading || !projectDir}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderPlus className="w-5 h-5" />}
          {loading ? 'Creating...' : 'Create Directory'}
        </button>
      </div>
    </div>
  );
}
