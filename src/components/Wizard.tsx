'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronLeft } from 'lucide-react';

import Step1GitHubLogin from './steps/Step1GitHubLogin';
import Step2RepoSelect from './steps/Step2RepoSelect';
import Step3EnvConfig from './steps/Step3EnvConfig';
import Step3DirSelect from './steps/Step3DirSelect';
import Step4Detection from './steps/Step4Detection';
import Step5Installation from './steps/Step5Installation';
import Step6Runtime from './steps/Step6Runtime';
import Step7Domain from './steps/Step7Domain';
import Step8IPDetect from './steps/Step8IPDetect';
import Step9DNSCheck from './steps/Step9DNSCheck';
import Step10SSL from './steps/Step10SSL';
import Step11Nginx from './steps/Step11Nginx';
import Step12FinalSetup from './steps/Step12FinalSetup';
import Step13Completion from './steps/Step13Completion';

interface WizardProps {
  user?: any;
  onNavigate?: (page: string) => void;
}

export default function Wizard({ user, onNavigate }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [wizardData, setWizardData] = useState<any>({
    githubToken: '',
    selectedRepo: null,
    branch: 'main',
    envVars: {},
    dirPath: '',
    detection: null,
    installCmd: 'npm install',
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    port: 3000,
    domain: '',
    wwwDomain: '',
    vpsIp: '',
    sslConfig: null,
    sshKey: '',
  });

  useEffect(() => {
    if (user?.githubToken) {
      setWizardData((prev: any) => ({ ...prev, githubToken: user.githubToken }));
      setCurrentStep(2);
    }
  }, [user]);

  const stepsList = [
    'GitHub Login',
    'Repository',
    'Environment',
    'Directory',
    'Detection',
    'Installation',
    'Runtime',
    'Domain',
    'VPS IP',
    'DNS Check',
    'SSL Setup',
    'Nginx',
    'Final Setup',
    'Completion',
  ];

  const updateData = (fields: Partial<typeof wizardData>) => {
    setWizardData((prev: any) => ({ ...prev, ...fields }));
  };

  const goToNext = (fields?: any) => {
    if (fields) updateData(fields);
    setCurrentStep((prev) => Math.min(prev + 1, 14));
  };

  const goToPrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const createProjectInDB = async () => {
    try {
      const repoName = wizardData.selectedRepo?.name || 'my-project';
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          repository: {
            fullName: wizardData.selectedRepo?.fullName,
            branch: wizardData.branch,
            cloneUrl: wizardData.selectedRepo?.cloneUrl,
          },
          directory: wizardData.dirPath,
          framework: wizardData.detection?.framework?.toLowerCase() || 'custom',
        }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        const projectId = data.project.id;
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            port: wizardData.port,
            startCommand: wizardData.startCmd,
            buildCommand: wizardData.buildCmd,
            installCommand: wizardData.installCmd,
            processManager: 'pm2',
          }),
        });
        if (Object.keys(wizardData.envVars).length > 0) {
          for (const [key, value] of Object.entries(wizardData.envVars)) {
            await fetch(`/api/projects/${projectId}/env`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key, value, isSecret: false }),
            });
          }
        }
        if (wizardData.domain) {
          await fetch(`/api/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: wizardData.domain, isPrimary: true }),
          });
        }
      }
    } catch (e) {
      console.error('Failed to create project in DB:', e);
    }
  };

  const handleComplete = async () => {
    await createProjectInDB();
    if (onNavigate) onNavigate('projects');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6 border-b border-gray-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-brand-500/20">
            F
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <span>FLUID</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                VPS Assistant
              </span>
            </h1>
            <p className="text-xs text-gray-400">Automated Deployment Wizard</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {currentStep > 1 && currentStep < 14 && (
            <button
              onClick={goToPrev}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div className="hidden md:flex items-center space-x-2 font-mono text-xs text-gray-400">
            <span>Step {currentStep} of 14</span>
            <span className="text-gray-600">|</span>
            <span className="text-brand-400 font-semibold">{stepsList[currentStep - 1]}</span>
          </div>
        </div>
      </header>

      {/* Stepper Progress Bar */}
      <div className="py-6 overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-[700px]">
          {stepsList.map((name, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div key={name} className="flex-1 flex items-center">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-brand-500 text-white ring-4 ring-brand-500/20 shadow-lg shadow-brand-500/30'
                      : 'bg-dark-card border border-gray-800 text-gray-500'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                {stepNum < 14 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 transition-all ${
                      stepNum < currentStep ? 'bg-emerald-500/80' : 'bg-gray-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Step Container */}
      <main className="flex-1 my-4 transition-all duration-300">
        <div className="w-full">
          {currentStep === 1 && (
            <Step1GitHubLogin
              onNext={(data) => goToNext({ githubToken: data.githubToken })}
            />
          )}

          {currentStep === 2 && (
            <Step2RepoSelect
              githubToken={wizardData.githubToken}
              onNext={(data) =>
                goToNext({ selectedRepo: data.selectedRepo, branch: data.branch })
              }
            />
          )}

          {currentStep === 3 && (
            <Step3EnvConfig
              dirPath={wizardData.dirPath || `/var/www/${wizardData.selectedRepo?.name || 'my-project'}`}
              onNext={(data) => goToNext({ envVars: data.envVars })}
            />
          )}

          {currentStep === 4 && (
            <Step3DirSelect
              selectedRepo={wizardData.selectedRepo}
              branch={wizardData.branch}
              githubToken={wizardData.githubToken}
              onNext={(data) => goToNext({ dirPath: data.dirPath })}
            />
          )}

          {currentStep === 5 && (
            <Step4Detection
              dirPath={wizardData.dirPath}
              onNext={(data) =>
                goToNext({
                  detection: data.detection,
                  installCmd: data.installCmd,
                  buildCmd: data.buildCmd,
                  startCmd: data.startCmd,
                  port: data.port,
                })
              }
            />
          )}

          {currentStep === 6 && (
            <Step5Installation
              dirPath={wizardData.dirPath}
              installCmd={wizardData.installCmd}
              buildCmd={wizardData.buildCmd}
              envVars={wizardData.envVars}
              onNext={() => goToNext()}
            />
          )}

          {currentStep === 7 && (
            <Step6Runtime
              dirPath={wizardData.dirPath}
              repoName={wizardData.selectedRepo?.name}
              startCmd={wizardData.startCmd}
              port={wizardData.port}
              onNext={() => goToNext()}
            />
          )}

          {currentStep === 8 && (
            <Step7Domain
              onNext={(data) =>
                goToNext({ domain: data.domain, wwwDomain: data.wwwDomain })
              }
            />
          )}

          {currentStep === 9 && (
            <Step8IPDetect
              domain={wizardData.domain}
              wwwDomain={wizardData.wwwDomain}
              onNext={(vpsIp) => goToNext({ vpsIp })}
            />
          )}

          {currentStep === 10 && (
            <Step9DNSCheck
              domain={wizardData.domain}
              wwwDomain={wizardData.wwwDomain}
              expectedIp={wizardData.vpsIp}
              onNext={() => goToNext()}
            />
          )}

          {currentStep === 11 && (
            <Step10SSL
              domain={wizardData.domain}
              wwwDomain={wizardData.wwwDomain}
              onNext={(sslConfig) => goToNext({ sslConfig })}
            />
          )}

          {currentStep === 12 && (
            <Step11Nginx
              domain={wizardData.domain}
              wwwDomain={wizardData.wwwDomain}
              port={wizardData.port}
              onNext={() => goToNext()}
            />
          )}

          {currentStep === 13 && (
            <Step12FinalSetup
              selectedRepo={wizardData.selectedRepo}
              githubToken={wizardData.githubToken}
              onNext={(data) => goToNext({ sshKey: data.sshKey })}
            />
          )}

          {currentStep === 14 && (
            <Step13Completion
              repoName={wizardData.selectedRepo?.name}
              domain={wizardData.domain}
              sshKey={wizardData.sshKey}
              port={wizardData.port}
              onComplete={handleComplete}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="pt-6 border-t border-gray-800/80 text-center text-xs text-gray-500 space-y-1">
        <p>FLUID VPS Deployment Assistant</p>
      </footer>
    </div>
  );
}
