import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Terminal, Github, Server, Globe, Shield, CheckCircle, Loader2 } from 'lucide-react';
import io from 'socket.io-client';

// Step Components
import AuthStep from './components/AuthStep';
import RepoStep from './components/RepoStep';
import DirectoryStep from './components/DirectoryStep';
import EnvStep from './components/EnvStep';
import DomainStep from './components/DomainStep';
import DnsStep from './components/DnsStep';
import SslStep from './components/SslStep';
const BuildStep = React.lazy(() => import('./components/BuildStep'));
const TerminalStep = React.lazy(() => import('./components/TerminalStep'));
const CompleteStep = React.lazy(() => import('./components/CompleteStep'));

const socket = io('http://localhost:3000');

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(9);
  const [installData, setInstallData] = useState({
    githubToken: null,
    githubUser: null,
    repo: null,
    permissions: ['read', 'write'],
    projectDir: '',
    envVars: {},
    domain: '',
    wwwDomain: '',
    vpsIp: '',
    sslProvider: 'letsencrypt',
    sslEmail: '',
    buildCommands: null,
    projectType: null,
    sshKey: null
  });
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [sessionId] = useState(`session-${Date.now()}`);

  useEffect(() => {
    socket.emit('join-terminal', sessionId);
    
    socket.on('terminal-output', (data) => {
      setTerminalOutput(prev => [...prev, data.data]);
    });

    return () => {
      socket.off('terminal-output');
    };
  }, [sessionId]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const updateInstallData = (key, value) => {
    setInstallData(prev => ({ ...prev, [key]: value }));
  };

  const steps = [
    { number: 1, title: 'GitHub Auth', icon: Github },
    { number: 2, title: 'Repository', icon: Github },
    { number: 3, title: 'Directory', icon: Server },
    { number: 4, title: 'Environment', icon: Terminal },
    { number: 5, title: 'Domain', icon: Globe },
    { number: 6, title: 'DNS Check', icon: Globe },
    { number: 7, title: 'SSL Setup', icon: Shield },
    { number: 8, title: 'Build & Deploy', icon: Terminal },
    { number: 9, title: 'Complete', icon: CheckCircle },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <AuthStep data={installData} onUpdate={updateInstallData} onNext={nextStep} />;
      case 2:
        return <RepoStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <DirectoryStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 4:
        return <EnvStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 5:
        return <DomainStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 6:
        return <DnsStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 7:
        return <SslStep data={installData} onUpdate={updateInstallData} onNext={nextStep} onPrev={prevStep} />;
      case 8:
        return (
          <React.Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}>
            <BuildStep 
              data={installData} 
              onUpdate={updateInstallData} 
              onNext={nextStep} 
              onPrev={prevStep} 
              socket={socket}
              sessionId={sessionId}
              terminalOutput={terminalOutput}
              setTerminalOutput={setTerminalOutput}
            />
          </React.Suspense>
        );
      case 9:
        return (
          <React.Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}>
            <CompleteStep data={installData} />
          </React.Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Fluid VPS Installer</h1>
            </div>
            <div className="text-sm text-gray-400">
              Ubuntu Server Setup
            </div>
          </div>
        </header>

        {/* Progress Steps */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.number;
                const isCurrent = currentStep === step.number;
                const isPending = currentStep < step.number;

                return (
                  <React.Fragment key={step.number}>
                    <div className="flex flex-col items-center">
                      <div className={`step-indicator ${isCompleted ? 'step-completed' : isCurrent ? 'step-active' : 'step-pending'}`}>
                        {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs mt-2 ${isCurrent ? 'text-primary-400' : isCompleted ? 'text-green-400' : 'text-gray-500'}`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-600' : 'bg-gray-700'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="card">
            {renderStep()}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4 mt-8">
          <div className="max-w-6xl mx-auto text-center text-sm text-gray-400">
            Fluid VPS Installer - Professional Ubuntu Server Deployment
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
