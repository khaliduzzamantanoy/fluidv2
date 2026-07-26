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
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [isRunning, setIsRunning] = useState(false);

  // Drain the write queue on the next animation frame — prevents xterm render backpressure
  const flushQueue = () => {
    if (xtermRef.current && queueRef.current.length > 0) {
      const batch = queueRef.current.splice(0);
      batch.forEach((chunk) => xtermRef.current.write(chunk));
    }
    rafRef.current = null;
  };

  const writeToTerm = (data: string) => {
    queueRef.current.push(data);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flushQueue);
    }
  };

  useEffect(() => {
    let term: any;
    let fit: any;

    async function init() {
      if (!terminalRef.current) return;

      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new XTerm({
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
          brightBlack: '#334155',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightCyan: '#22d3ee',
        },
        fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.35,
        cursorBlink: true,
        convertEol: true,
        scrollback: 5000,
        // Let xterm handle carriage return properly for progress lines
        windowsMode: false,
      });

      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(terminalRef.current);
      setTimeout(() => fit.fit(), 50);

      xtermRef.current = term;
      fitAddonRef.current = fit;

      term.writeln('\x1b[36mFLUID Terminal Session Initialized...\x1b[0m\r\n');

      if (command && autoRun) {
        runCommand(command, cwd);
      }
    }

    init();

    const handleResize = () => {
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch (e) {}
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (socketRef.current) socketRef.current.close();
      if (term) term.dispose();
    };
  }, []);

  const runCommand = async (cmdToRun: string, workDir?: string) => {
    if (!cmdToRun || !xtermRef.current) return;

    setIsRunning(true);
    setStatus('running');
    writeToTerm(`\x1b[33mExecuting: ${cmdToRun}\x1b[0m\r\n`);

    // Use REST API instead of WebSocket for better compatibility
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdToRun, cwd: workDir || '/tmp' })
      });

      const data = await response.json();
      
      if (data.stdout) {
        writeToTerm(data.stdout);
      }
      
      if (data.stderr) {
        writeToTerm('\r\n\x1b[31m' + data.stderr + '\x1b[0m\r\n');
      }

      const success = data.success;
      setIsRunning(false);
      setStatus(success ? 'success' : 'failed');
      
      if (success) {
        writeToTerm('\r\n\x1b[32m✓ Process finished successfully\x1b[0m\r\n');
      } else {
        writeToTerm('\r\n\x1b[31m✗ Process failed with code ' + data.exitCode + '\x1b[0m\r\n');
      }

      if (onComplete) onComplete(success);
    } catch (error) {
      console.error('Command execution error:', error);
      writeToTerm('\r\n\x1b[31m[Command Execution Error]\x1b[0m\r\n');
      writeToTerm('\x1b[31m' + (error as Error).message + '\x1b[0m\r\n');
      setIsRunning(false);
      setStatus('failed');
      if (onComplete) onComplete(false);
    }
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
            <span className="flex items-center text-xs text-sky-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-sky-400 mr-2 animate-ping" />
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
      <div className="p-3 min-h-[300px] max-h-[480px] overflow-hidden">
        <div ref={terminalRef} className="w-full h-full min-h-[280px]" />
      </div>

      {/* Retry */}
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
