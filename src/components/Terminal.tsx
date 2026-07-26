'use client';

import { useEffect, useRef, useState } from 'react';

interface TerminalProps {
  command?: string;
  cwd?: string;
  autoRun?: boolean;
  onComplete?: (success: boolean) => void;
}

export default function Terminal({ command, cwd, autoRun = true, onComplete }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  useEffect(() => {
    let term: any = null;
    let fitAddon: any = null;

    async function initXterm() {
      if (!terminalRef.current) return;
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new Terminal({
        theme: {
          background: '#090d16',
          foreground: '#e2e8f0',
          cursor: '#0ea5e9',
          selectionBackground: 'rgba(14, 165, 233, 0.3)',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f8fafc',
        },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: true,
        convertEol: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();
      xtermInstance.current = term;

      term.writeln('\x1b[36mFLUID Terminal Session Initialized...\x1b[0m\r\n');

      if (command && autoRun) {
        runCommand(command, cwd);
      }
    }

    initXterm();

    const handleResize = () => {
      if (fitAddon) {
        try { fitAddon.fit(); } catch (e) {}
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (term) {
        term.dispose();
      }
    };
  }, []);

  const runCommand = (cmdToRun: string, workDir?: string) => {
    if (!cmdToRun) return;
    setIsRunning(true);
    setStatus('running');

    if (xtermInstance.current) {
      xtermInstance.current.writeln(`\x1b[33mExecuting: ${cmdToRun}\x1b[0m\r\n`);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${host}:6776/ws/terminal`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ command: cmdToRun, cwd: workDir }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (xtermInstance.current && msg.data) {
          xtermInstance.current.write(msg.data);
        }
        if (msg.type === 'exit') {
          setIsRunning(false);
          const success = msg.code === 0;
          setStatus(success ? 'success' : 'failed');
          if (onComplete) onComplete(success);
        }
      } catch (err) {
        if (xtermInstance.current) {
          xtermInstance.current.write(event.data);
        }
      }
    };

    ws.onerror = () => {
      if (xtermInstance.current) {
        xtermInstance.current.writeln('\r\n\x1b[31m[WebSocket Connection Error]\x1b[0m');
      }
      setIsRunning(false);
      setStatus('failed');
      if (onComplete) onComplete(false);
    };
  };

  return (
    <div className="w-full flex flex-col rounded-xl overflow-hidden border border-gray-800 bg-[#090d16] shadow-2xl">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f172a] border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-xs font-mono text-gray-400">fluid-terminal ~ bash</span>
        </div>
        <div className="flex items-center space-x-3">
          {status === 'running' && (
            <span className="flex items-center text-xs text-brand-400 font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-brand-400 mr-2 animate-ping" />
              Running...
            </span>
          )}
          {status === 'success' && (
            <span className="text-xs text-emerald-400 font-mono font-medium">✓ Completed</span>
          )}
          {status === 'failed' && (
            <span className="text-xs text-red-400 font-mono font-medium">✗ Failed</span>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div className="p-3 min-h-[260px] max-h-[400px]">
        <div ref={terminalRef} className="w-full h-full min-h-[240px]" />
      </div>

      {/* Manual Retry Controls */}
      {status === 'failed' && command && (
        <div className="p-3 bg-red-950/40 border-t border-red-900/50 flex items-center justify-between">
          <span className="text-xs text-red-300">Process exited with non-zero status.</span>
          <button
            onClick={() => runCommand(command, cwd)}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-medium transition"
          >
            Retry Command
          </button>
        </div>
      )}
    </div>
  );
}
