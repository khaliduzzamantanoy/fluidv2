import React, { useEffect, useState } from 'react';
import { Terminal, X, Copy, Maximize2, Minimize2 } from 'lucide-react';

export default function TerminalStep({ socket, sessionId }) {
  const [output, setOutput] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleTerminalOutput = (data) => {
      setOutput(prev => [...prev, data.data]);
    };

    socket.on('terminal-output', handleTerminalOutput);

    return () => {
      socket.off('terminal-output', handleTerminalOutput);
    };
  }, [socket, sessionId]);

  const copyOutput = () => {
    navigator.clipboard.writeText(output.join('\n'));
  };

  const clearOutput = () => {
    setOutput([]);
  };

  return (
    <div className={`space-y-4 ${isExpanded ? 'fixed inset-4 z-50 bg-gray-900 rounded-xl p-6 flex flex-col' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary-400" />
          Terminal Output
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={copyOutput}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy output"
          >
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={clearOutput}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Clear output"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className={`terminal flex-1 ${isExpanded ? 'flex' : ''}`}>
        {output.length === 0 ? (
          <div className="text-gray-500">Waiting for terminal output...</div>
        ) : (
          output.map((line, index) => (
            <div key={index} className="terminal-line">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
