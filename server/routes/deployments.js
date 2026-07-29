import { getPrisma } from '../services/database.js';
import { authenticate } from '../middleware/auth.js';

export default async function deploymentRoutes(fastify) {
  fastify.get('/api/deployments/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const deployment = await prisma.deployment.findUnique({
      where: { id: request.params.id },
      include: {
        project: { select: { name: true, slug: true } },
        user: { select: { username: true } }
      }
    });
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }
    return reply.send({ success: true, deployment });
  });

  fastify.get('/api/deployments/:id/logs', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const deployment = await prisma.deployment.findUnique({
      where: { id: request.params.id },
      select: { logChunks: true }
    });
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }

    const logChunks = Array.isArray(deployment.logChunks) ? deployment.logChunks : [];
    const chunk = parseInt(request.query.chunk) || 0;
    const limit = parseInt(request.query.limit) || 100;
    const logs = logChunks
      .filter(l => l.sequence >= chunk * limit && l.sequence < (chunk + 1) * limit)
      .map(l => ({ seq: l.sequence, content: l.content, stream: l.stream, ts: l.timestamp }));

    return reply.send({
      success: true,
      logs,
      total: logChunks.length,
      chunk,
      hasMore: (chunk + 1) * limit < logChunks.length
    });
  });

  fastify.post('/api/projects/:id/deploy', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { branch, commitSha, commitMessage } = request.body || {};

    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        userId: request.user.id,
        trigger: 'manual',
        triggerMetadata: {
          commitSha: commitSha || 'manual',
          commitMessage: commitMessage || 'Manual deployment',
          branch: branch || project.repository?.branch || 'main'
        },
        status: 'queued',
        environment: 'production'
      }
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'deploying',
        lastDeployedAt: new Date(),
        deploymentCount: { increment: 1 }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'deployment.start',
        category: 'deployment',
        description: `Started deployment for ${project.name}`,
        metadata: { deploymentId: deployment.id, trigger: 'manual' },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    executeDeployment(deployment.id, project).catch(err => {
      console.error('[Deploy] Background execution error:', err.message);
    });

    return reply.status(201).send({ success: true, deployment });
  });

  fastify.post('/api/deployments/:id/cancel', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const deployment = await prisma.deployment.findUnique({ where: { id: request.params.id } });
    if (!deployment) {
      return reply.status(404).send({ success: false, error: 'Deployment not found' });
    }

    if (['success', 'failed', 'cancelled'].includes(deployment.status)) {
      return reply.status(400).send({ success: false, error: 'Deployment already finished' });
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: request.user.id }
    });

    return reply.send({ success: true, deployment });
  });

  fastify.post('/api/projects/:id/rollback', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const targetDeployment = await prisma.deployment.findUnique({
      where: { id: request.body?.deploymentId }
    });
    if (!targetDeployment || targetDeployment.projectId !== project.id) {
      return reply.status(404).send({ success: false, error: 'Target deployment not found' });
    }

    if (targetDeployment.status !== 'success') {
      return reply.status(400).send({ success: false, error: 'Can only rollback to successful deployments' });
    }

    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        userId: request.user.id,
        trigger: 'rollback',
        triggerMetadata: {
          commitSha: targetDeployment.commitSha,
          commitMessage: `Rollback to ${targetDeployment.commitSha?.substring(0, 7) || 'previous'}`
        },
        status: 'queued',
        previousDeploymentId: targetDeployment.id,
        environment: 'production'
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'deployment.rollback',
        category: 'deployment',
        description: `Rollback to deployment ${targetDeployment.id}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, deployment, rollbackTo: targetDeployment.id });
  });
}

async function executeDeployment(deploymentId, project) {
  const { exec } = await import('child_process');
  const util = await import('util');
  const execPromise = util.promisify(exec);
  const fs = await import('fs');
  const { getPrisma } = await import('../services/database.js');

  const updateStatus = async (status, stage) => {
    const prisma = getPrisma();
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status, stage } });
  };

  const appendLog = async (content, stream = 'stdout') => {
    const prisma = getPrisma();
    const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment) return;
    const logChunks = Array.isArray(deployment.logChunks) ? deployment.logChunks : [];
    const sequence = logChunks.length;
    logChunks.push({ sequence, content, stream, timestamp: new Date().toISOString() });
    await prisma.deployment.update({ where: { id: deploymentId }, data: { logChunks } });
  };

  const updateStage = async (name, status, error = null) => {
    const prisma = getPrisma();
    const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment) return;
    const stages = Array.isArray(deployment.stages) ? deployment.stages : [];
    const idx = stages.findIndex(s => s.name === name);
    if (idx >= 0) {
      stages[idx].status = status;
      stages[idx].finishedAt = new Date().toISOString();
      if (error) stages[idx].error = error;
    } else {
      stages.push({ name, status, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), logs: '', error });
    }
    await prisma.deployment.update({ where: { id: deploymentId }, data: { stages } });
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

    if (project.repository?.url) {
      const repoUrl = project.repository.cloneUrl || project.repository.url;
      if (fs.existsSync(dir)) {
        await executeCommand(
          `cd ${dir} && git fetch origin && git reset --hard origin/${project.repository.branch}`,
          'pull', dir
        );
      } else {
        await executeCommand(
          `mkdir -p ${dir} && git clone --depth 1 -b ${project.repository.branch} ${repoUrl} ${dir}`,
          'clone', '/tmp'
        );
      }
    }

    const installOk = await executeCommand(project.installCommand || 'npm install', 'install', dir);
    if (!installOk) throw new Error('Installation failed');

    if (project.buildCommand) {
      const buildOk = await executeCommand(project.buildCommand, 'build', dir);
      if (!buildOk) throw new Error('Build failed');
    }

    const deployStage = project.processManager === 'pm2' ? 'restart_pm2' :
      project.processManager === 'docker' ? 'docker_deploy' : 'restart_service';

    let deployOk = false;
    if (project.processManager === 'pm2') {
      if (project.startCommand) {
        const appName = project.slug;
        deployOk = await executeCommand(
          `pm2 delete ${appName} 2>/dev/null; pm2 start ${project.startCommand} --name "${appName}" -i ${project.pm2Config?.instances || 1}`,
          deployStage, dir
        );
      }
    } else if (project.processManager === 'docker') {
      deployOk = await executeCommand(`cd ${dir} && docker compose up -d --build`, deployStage, dir);
    } else {
      deployOk = await executeCommand(`cd ${dir} && ${project.startCommand || 'npm start'} &`, deployStage, dir);
    }

    if (!deployOk) throw new Error('Deploy stage failed');

    const duration = Date.now() - startTime;
    const prisma = getPrisma();
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'success', finishedAt: new Date(), duration, exitCode: 0 }
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'active', lastSuccessfulDeployAt: new Date(), totalBuildTime: (project.totalBuildTime || 0) + duration }
    });
    await appendLog(`\n\x1b[32m✓ Deployment successful (${(duration / 1000).toFixed(1)}s)\x1b[0m\n`);

  } catch (err) {
    const prisma = getPrisma();
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'failed', finishedAt: new Date(), exitCode: 1, error: err.message }
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'error' } });
    await appendLog(`\n\x1b[31m✗ Deployment failed: ${err.message}\x1b[0m\n`, 'stderr');
  }
}
