import React, { useState, useEffect } from 'react';
import { Terminal, Play, Settings, CheckCircle, AlertCircle, Loader2, Cpu } from 'lucide-react';
import axios from 'axios';

export default function BuildStep({ data, onUpdate, onNext, onPrev, socket, sessionId, terminalOutput, setTerminalOutput }) {
  const [projectType, setProjectType] = useState(null);
  const [buildCommands, setBuildCommands] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [currentStep, setCurrentStep] = useState('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const steps = [
    { id: 'clone', name: 'Cloning Repository', icon: Terminal },
    { id: 'detect', name: 'Detecting Project Type', icon: Cpu },
    { id: 'install', name: 'Installing Dependencies', icon: Settings },
    { id: 'build', name: 'Building Project', icon: Play },
    { id: 'configure', name: 'Configuring Server', icon: Settings },
    { id: 'ssl', name: 'Setting up SSL', icon: CheckCircle },
    { id: 'pm2', name: 'Configuring PM2', icon: Settings },
  ];

  useEffect(() => {
    if (data.projectDir && data.repo) {
      detectProject();
    }
  }, [data.projectDir, data.repo]);

  const detectProject = async () => {
    try {
      const typeResponse = await axios.post('/api/project/detect-type', { projectPath: data.projectDir });
      setProjectType(typeResponse.data);

      const buildResponse = await axios.post('/api/project/detect-build', { projectPath: data.projectDir });
      setBuildCommands(buildResponse.data);
      onUpdate('buildCommands', buildResponse.data);
      onUpdate('projectType', typeResponse.data);
    } catch (err) {
      // Project might not be cloned yet
    }
  };

  const startDeployment = async () => {
    setInstalling(true);
    setError('');
    setProgress(0);

    try {
      // Step 1: Setup VPS
      setCurrentStep('setup');
      setProgress(10);
      await axios.post('/api/vps/setup', {
        ...data.vpsConfig,
        projectDir: data.projectDir,
        sshPublicKey: data.sshKeys?.publicKeyOpenSSH
      });

      // Step 2: Clone Repository on VPS
      setCurrentStep('clone');
      setProgress(20);
      await axios.post('/api/vps/execute', {
        ...data.vpsConfig,
        command: `git clone ${data.repo.clone_url} ${data.projectDir}`,
        sessionId
      });

      // Step 3: Detect Project Type
      setCurrentStep('detect');
      setProgress(30);
      const typeResponse = await axios.post('/api/vps/execute', {
        ...data.vpsConfig,
        command: `cd ${data.projectDir} && ls -la`,
        sessionId
      });
      setProjectType(typeResponse.data);
      onUpdate('projectType', typeResponse.data);

      // Step 4: Install Dependencies on VPS
      setCurrentStep('install');
      setProgress(50);
      await axios.post('/api/vps/install-deps', {
        ...data.vpsConfig,
        projectType: typeResponse.data?.type || 'nodejs',
        framework: typeResponse.data?.framework || 'generic',
        sessionId
      });

      // Step 5: Build Project on VPS
      setCurrentStep('build');
      setProgress(70);
      if (buildCommands?.build) {
        await axios.post('/api/vps/execute', {
          ...data.vpsConfig,
          command: `cd ${data.projectDir} && ${buildCommands.build}`,
          sessionId
        });
      }

      // Step 6: Configure Nginx on VPS
      setCurrentStep('configure');
      setProgress(80);
      await axios.post('/api/vps/execute', {
        ...data.vpsConfig,
        command: `sudo nginx -t && sudo systemctl reload nginx`,
        sessionId
      });

      // Step 7: Setup SSL on VPS
      setCurrentStep('ssl');
      setProgress(90);
      if (data.domain && data.sslProvider === 'letsencrypt') {
        await axios.post('/api/vps/execute', {
          ...data.vpsConfig,
          command: `sudo certbot --nginx -d ${data.domain} -d www.${data.domain} --non-interactive --agree-tos --email ${data.sslEmail}`,
          sessionId
        });
      }

      // Step 8: Setup PM2 on VPS
      setCurrentStep('pm2');
      setProgress(95);
      await axios.post('/api/vps/execute', {
        ...data.vpsConfig,
        command: `cd ${data.projectDir} && pm2 start ${buildCommands?.start || 'npm start'} --name ${data.repo.name}`,
        sessionId
      });

      setProgress(100);
      setCurrentStep('complete');
      
      setTimeout(() => {
        onNext();
      }, 2000);

    } catch (err) {
      setError(`Deployment failed: ${err.message}`);
      setInstalling(false);
    }
  };

  const getStepStatus = (stepId) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Build & Deploy</h2>
        <p className="text-gray-400">
          {installing ? 'Deployment in progress...' : 'Ready to deploy your project to the VPS.'}
        </p>
      </div>

      {/* Project Detection Info */}
      {projectType && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-400" />
            Detected Project Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="ml-2 font-medium capitalize">{projectType.type}</span>
            </div>
            <div>
              <span className="text-gray-400">Framework:</span>
              <span className="ml-2 font-medium capitalize">{projectType.framework || 'Unknown'}</span>
            </div>
          </div>
          {buildCommands && (
            <div className="mt-3 space-y-1 text-sm">
              <div><span className="text-gray-400">Install:</span> <span className="font-mono text-xs">{buildCommands.install}</span></div>
              {buildCommands.build && <div><span className="text-gray-400">Build:</span> <span className="font-mono text-xs">{buildCommands.build}</span></div>}
              <div><span className="text-gray-400">Start:</span> <span className="font-mono text-xs">{buildCommands.start}</span></div>
              {buildCommands.note && <div className="text-yellow-400 text-xs mt-1">⚠️ {buildCommands.note}</div>}
            </div>
          )}
          
          {/* Framework-specific info */}
          {projectType.framework === 'docker-compose' && (
            <div className="mt-3 p-2 bg-blue-500/10 rounded text-xs text-blue-400">
              🐳 Docker Compose detected - will use docker-compose for deployment
            </div>
          )}
          {projectType.framework === 'docker' && (
            <div className="mt-3 p-2 bg-blue-500/10 rounded text-xs text-blue-400">
              🐳 Dockerfile detected - will build and run Docker container
            </div>
          )}
          {projectType.framework === 'wordpress' && (
            <div className="mt-3 p-2 bg-purple-500/10 rounded text-xs text-purple-400">
              📝 WordPress detected - requires PHP and web server configuration
            </div>
          )}
          {projectType.framework === 'laravel' && (
            <div className="mt-3 p-2 bg-red-500/10 rounded text-xs text-red-400">
              🎨 Laravel detected - will run migrations and build assets
            </div>
          )}
          {projectType.framework === 'django' && (
            <div className="mt-3 p-2 bg-green-500/10 rounded text-xs text-green-400">
              🐍 Django detected - will collect static files and use Gunicorn
            </div>
          )}
          {projectType.framework === 'rails' && (
            <div className="mt-3 p-2 bg-red-500/10 rounded text-xs text-red-400">
              💎 Ruby on Rails detected - will precompile assets
            </div>
          )}
          {projectType.framework === 'rust' && (
            <div className="mt-3 p-2 bg-orange-500/10 rounded text-xs text-orange-400">
              🦀 Rust detected - will build release binary
            </div>
          )}
        </div>
      )}

      {/* Progress Steps */}
      <div className="space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const status = getStepStatus(step.id);
          
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                status === 'current' ? 'bg-primary-500/10 border border-primary-500/30' :
                status === 'completed' ? 'bg-green-500/10 border border-green-500/30' :
                'bg-gray-800 border border-gray-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                status === 'completed' ? 'bg-green-600' :
                status === 'current' ? 'bg-primary-600' :
                'bg-gray-700'
              }`}>
                {status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : status === 'current' ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <span className={`font-medium ${
                status === 'completed' ? 'text-green-400' :
                status === 'current' ? 'text-primary-400' :
                'text-gray-400'
              }`}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      {installing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-primary-400">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div>
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary-400" />
          Live Terminal Output
        </h3>
        <div className="terminal">
          {terminalOutput.length === 0 ? (
            <div className="text-gray-500">Terminal output will appear here...</div>
          ) : (
            terminalOutput.map((line, index) => (
              <div key={index} className="terminal-line">
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button 
          onClick={onPrev} 
          disabled={installing}
          className="btn-secondary"
        >
          Back
        </button>
        {!installing && (
          <button
            onClick={startDeployment}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Deployment
          </button>
        )}
      </div>
    </div>
  );
}
