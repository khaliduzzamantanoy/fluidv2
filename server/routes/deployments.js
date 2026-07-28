import Deployment from '../models/Deployment.js';
import Project from '../models/Project.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate } from '../middleware/auth.js';

export default async function deploymentRoutes(fastify) {
  // Get deployment details
  fastify.get('/api/deployments/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const deployment = await Deployment.findById(request.params.id)
      .populate('projectId', 'name slug')
      .populate('userId', 'username');
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }
    return reply.send({ success: true, deployment });
  });

  // Get deployment logs (paginated chunks)
  fastify.get('/api/deployments/:id/logs', { preHandler: [authenticate] }, async (request, reply) => {
    const deployment = await Deployment.findById(request.params.id);
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }

    const chunk = parseInt(request.query.chunk) || 0;
    const limit = parseInt(request.query.limit) || 100;
    const logs = deployment.logChunks
      .filter(l => l.sequence >= chunk * limit && l.sequence < (chunk + 1) * limit)
      .map(l => ({ seq: l.sequence, content: l.content, stream: l.stream, ts: l.timestamp }));

    return reply.send({
      success: true,
      logs,
      total: deployment.logChunks.length,
      chunk,
      hasMore: (chunk + 1) * limit < deployment.logChunks.length
    });
  });

  // Trigger new deployment
  fastify.post('/api/projects/:id/deploy', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { branch, commitSha, commitMessage } = request.body || {};

    const deployment = await Deployment.create({
      projectId: project._id,
      userId: request.user._id,
      trigger: 'manual',
      triggerMetadata: {
        commitSha: commitSha || 'manual',
        commitMessage: commitMessage || 'Manual deployment',
        branch: branch || project.repository.branch
      },
      status: 'queued',
      environment: 'production'
    });

    project.status = 'deploying';
    project.lastDeployedAt = new Date();
    project.deploymentCount += 1;
    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'deployment.start',
      category: 'deployment',
      description: `Started deployment for ${project.name}`,
      metadata: { deploymentId: deployment._id, trigger: 'manual' },
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    // Execute deployment in background
    executeDeployment(deployment._id, project).catch(err => {
      console.error('[Deploy] Background execution error:', err.message);
    });

    return reply.status(201).send({ success: true, deployment });
  });

  // Cancel deployment
  fastify.post('/api/deployments/:id/cancel', { preHandler: [authenticate] }, async (request, reply) => {
    const deployment = await Deployment.findById(request.params.id);
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }

    if (['success', 'failed', 'cancelled'].includes(deployment.status)) {
      return reply.status(400).send({ success: false, error: 'Deployment already finished' });
    }

    deployment.status = 'cancelled';
    deployment.cancelledAt = new Date();
    deployment.cancelledBy = request.user._id;
    await deployment.save();

    return reply.send({ success: true, deployment });
  });

  // Rollback to previous deployment
  fastify.post('/api/projects/:id/rollback', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const targetDeployment = await Deployment.findById(request.body?.deploymentId);
    if (!targetDeployment || targetDeployment.projectId.toString() !== project._id.toString()) {
      return reply.status(404).send({ success: false, error: 'Target deployment not found' });
    }

    if (targetDeployment.status !== 'success') {
      return reply.status(400).send({ success: false, error: 'Can only rollback to successful deployments' });
    }

    const deployment = await Deployment.create({
      projectId: project._id,
      userId: request.user._id,
      trigger: 'rollback',
      triggerMetadata: {
        commitSha: targetDeployment.commitSha,
        commitMessage: `Rollback to ${targetDeployment.commitSha?.substring(0, 7) || 'previous'}`
      },
      status: 'queued',
      previousDeploymentId: targetDeployment._id,
      environment: 'production'
    });

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'deployment.rollback',
      category: 'deployment',
      description: `Rollback to deployment ${targetDeployment._id}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, deployment, rollbackTo: targetDeployment._id });
  });
}

async function executeDeployment(deploymentId, project) {
  const { exec } = await import('child_process');
  const util = await import('util');
  const execPromise = util.promisify(exec);
  const fs = await import('fs');

  const updateStatus = async (status, stage) => {
    await Deployment.findByIdAndUpdate(deploymentId, { status, stage });
  };

  const appendLog = async (content, stream = 'stdout') => {
    const deployment = await Deployment.findById(deploymentId);
    if (!deployment) return;
    const sequence = deployment.logChunks.length;
    deployment.logChunks.push({ sequence, content, stream, timestamp: new Date() });
    await deployment.save();
  };

  const updateStage = async (name, status, error = null) => {
    const deployment = await Deployment.findById(deploymentId);
    if (!deployment) return;
    const idx = deployment.stages.findIndex(s => s.name === name);
    if (idx >= 0) {
      deployment.stages[idx].status = status;
      deployment.stages[idx].finishedAt = new Date();
      if (error) deployment.stages[idx].error = error;
    } else {
      deployment.stages.push({
        name, status,
        startedAt: new Date(),
        finishedAt: new Date(),
        logs: '',
        error
      });
    }
    await deployment.save();
  };

  const executeCommand = async (cmd, stageName, cwd) => {
    await updateStatus('running', stageName);
    await updateStage(stageName, 'running');
    await appendLog(`\n\x1b[36m$ ${cmd}\x1b[0m\n`);

    try {
      const { stdout, stderr } = await execPromise(cmd, { cwd, timeout: 300000 });
      if (stdout) await appendLog(stdout);
      if (stderr) await appendLog(stderr, 'stderr');
      await updateStage(stageName, 'success');
      return true;
    } catch (err) {
      await appendLog(err.stdout || '', 'stdout');
      await appendLog(err.stderr || err.message, 'stderr');
      await updateStage(stageName, 'failed', err.message);
      return false;
    }
  };

  try {
    const startTime = Date.now();
    const dir = project.directory;

    // Stage 1: Clone / Pull
    if (project.repository?.url) {
      const repoUrl = project.repository.cloneUrl || project.repository.url;
      let cloneResult;
      if (fs.existsSync(dir)) {
        cloneResult = await executeCommand(
          `cd ${dir} && git fetch origin && git reset --hard origin/${project.repository.branch}`,
          'pull', dir
        );
      } else {
        cloneResult = await executeCommand(
          `mkdir -p ${dir} && git clone --depth 1 -b ${project.repository.branch} ${repoUrl} ${dir}`,
          'clone', '/tmp'
        );
        // Restore node_modules from cache if available
      }
      if (!cloneResult) throw new Error('Git operation failed');
    }

    // Stage 2: Install dependencies
    const installOk = await executeCommand(
      project.installCommand || 'npm install',
      'install', dir
    );
    if (!installOk) throw new Error('Installation failed');

    // Stage 3: Build
    if (project.buildCommand) {
      const buildOk = await executeCommand(project.buildCommand, 'build', dir);
      if (!buildOk) throw new Error('Build failed');
    }

    // Stage 4: Deploy / Restart process
    const deployStage = project.processManager === 'pm2' ? 'restart_pm2' :
      project.processManager === 'docker' ? 'docker_deploy' : 'restart_service';

    let deployOk = false;
    if (project.processManager === 'pm2') {
      if (project.startCommand) {
        const appName = project.slug;
        deployOk = await executeCommand(
          `pm2 delete ${appName} 2>/dev/null; pm2 start ${project.startCommand} --name "${appName}" -i ${project.pm2Config?.instances || 1} -- ${project.port ? `--port=${project.port}` : ''}`,
          deployStage, dir
        );
      }
    } else if (project.processManager === 'docker') {
      deployOk = await executeCommand(
        `cd ${dir} && docker compose up -d --build`,
        deployStage, dir
      );
    } else {
      deployOk = await executeCommand(
        `cd ${dir} && ${project.startCommand || 'npm start'} &`,
        deployStage, dir
      );
    }

    if (!deployOk) throw new Error('Deploy stage failed');

    // Success
    const duration = Date.now() - startTime;
    await Deployment.findByIdAndUpdate(deploymentId, {
      status: 'success',
      finishedAt: new Date(),
      duration,
      exitCode: 0
    });

    await Project.findByIdAndUpdate(project._id, {
      status: 'active',
      lastSuccessfulDeployAt: new Date(),
      totalBuildTime: (project.totalBuildTime || 0) + duration
    });

    await appendLog(`\n\x1b[32m✓ Deployment successful (${(duration / 1000).toFixed(1)}s)\x1b[0m\n`);

  } catch (err) {
    await Deployment.findByIdAndUpdate(deploymentId, {
      status: 'failed',
      finishedAt: new Date(),
      exitCode: 1,
      error: err.message
    });

    await Project.findByIdAndUpdate(project._id, { status: 'error' });
    await appendLog(`\n\x1b[31m✗ Deployment failed: ${err.message}\x1b[0m\n`, 'stderr');
  }
}