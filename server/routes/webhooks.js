import { getPrisma } from '../services/database.js';
import crypto from 'crypto';

export default async function webhookRoutes(fastify) {
  fastify.post('/api/webhooks/github', async (request, reply) => {
    const prisma = getPrisma();
    const signature = request.headers['x-hub-signature-256'];
    const event = request.headers['x-github-event'];
    const deliveryId = request.headers['x-github-delivery'];
    const payload = request.body;

    if (!payload || !payload.repository) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook payload' });
    }

    const repoFullName = payload.repository.full_name;
    const project = await prisma.project.findFirst({
      where: { deletedAt: null }
    });

    if (!project) {
      await prisma.webhookDelivery.create({
        data: {
          webhookId: deliveryId,
          event,
          deliveryId,
          payload,
          status: 'failed',
          error: `No project found for ${repoFullName}`
        }
      });
      return reply.status(200).send({ success: false, error: 'No matching project' });
    }

    if (project.github?.webhookSecret) {
      const hmac = crypto.createHmac('sha256', project.github.webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
      if (signature !== digest) {
        await prisma.webhookDelivery.create({
          data: {
            projectId: project.id,
            webhookId: deliveryId,
            event,
            payload,
            deliveryId,
            signature,
            status: 'failed',
            error: 'Signature mismatch'
          }
        });
        return reply.status(401).send({ success: false, error: 'Invalid signature' });
      }
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        projectId: project.id,
        webhookId: deliveryId,
        event,
        payload,
        deliveryId,
        signature,
        status: 'pending'
      }
    });

    try {
      let shouldDeploy = false;
      let deployBranch = null;
      let commitSha = null;
      let commitMessage = null;

      if (event === 'push' && payload.ref) {
        const branch = payload.ref.replace('refs/heads/', '');
        deployBranch = branch;

        if (project.github?.branchFilters?.length > 0) {
          shouldDeploy = project.github.branchFilters.includes(branch);
        } else {
          shouldDeploy = branch === (project.repository?.branch || 'main');
        }

        commitSha = payload.after;
        commitMessage = payload.head_commit?.message;
      } else if (event === 'pull_request' && project.github?.deployPrs) {
        const action = payload.action;
        if (['opened', 'synchronize', 'reopened'].includes(action)) {
          shouldDeploy = true;
          deployBranch = payload.pull_request.head.ref;
          commitSha = payload.pull_request.head.sha;
          commitMessage = payload.pull_request.title;
        }
      }

      if (shouldDeploy) {
        const deployment = await prisma.deployment.create({
          data: {
            projectId: project.id,
            trigger: event === 'push' ? 'webhook_push' : 'webhook_pr',
            triggerMetadata: {
              commitSha,
              commitMessage: commitMessage || 'Webhook triggered deployment',
              branch: deployBranch,
              author: { name: payload.sender?.login, avatar: payload.sender?.avatar_url },
              compareUrl: payload.compare
            },
            status: 'queued'
          }
        });

        await prisma.project.update({
          where: { id: project.id },
          data: { status: 'deploying', lastDeployedAt: new Date(), deploymentCount: { increment: 1 } }
        });

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: 'delivered', processedAt: new Date(), responseBody: `Deployment created: ${deployment.id}` }
        });

        const { executeDeployment } = await import('./deployments.js');
        executeDeployment(deployment.id, project).catch(err => {
          console.error('[Webhook] Deploy execution error:', err.message);
        });

        return reply.send({
          success: true,
          action: 'deployment_created',
          deploymentId: deployment.id,
          branch: deployBranch,
          commitSha
        });
      }

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'delivered', processedAt: new Date(), responseBody: 'Received but no deployment triggered' }
      });

      return reply.send({ success: true, action: 'received', reason: 'conditions_not_met', branch: deployBranch, event });

    } catch (err) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error: err.message }
      });

      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/api/projects/:id/webhooks', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user?.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return reply.send({ success: true, deliveries });
  });

  fastify.post('/api/projects/:id/webhooks/register', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const prisma = getPrisma();
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, error: 'Auth required' });

    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    if (!project.repository?.owner || !project.repository?.repo) {
      return reply.status(400).send({ success: false, error: 'Repository not configured' });
    }

    const token = user.githubToken || process.env.GITHUB_TOKEN;
    if (!token) {
      return reply.status(400).send({ success: false, error: 'GitHub token not available. Connect GitHub first.' });
    }

    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 6776}`;

    try {
      const https = await import('https');
      const webhookPayload = JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'pull_request'],
        config: {
          url: `${baseUrl}/api/webhooks/github`,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0'
        }
      });

      const ghRes = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.github.com',
          path: `/repos/${project.repository.owner}/${project.repository.repo}/hooks`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Fluid-VPS-Portal',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(webhookPayload)
          }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
            catch { resolve({ status: res.statusCode, data: body }); }
          });
        });
        req.on('error', reject);
        req.write(webhookPayload);
        req.end();
      });

      if (ghRes.status >= 400) {
        return reply.status(400).send({ success: false, error: ghRes.data?.message || 'GitHub API error' });
      }

      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          github: {
            ...(typeof project.github === 'object' ? project.github : {}),
            webhookId: String(ghRes.data.id),
            webhookSecret,
            autoDeploy: true
          }
        }
      });

      return reply.send({
        success: true,
        webhook: { id: ghRes.data.id, url: ghRes.data.config.url, events: ghRes.data.events },
        project: updated
      });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.delete('/api/projects/:id/webhooks', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const prisma = getPrisma();
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, error: 'Auth required' });

    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    if (project.github?.webhookId && project.repository?.owner && project.repository?.repo) {
      const token = user.githubToken || process.env.GITHUB_TOKEN;
      if (token) {
        try {
          const https = await import('https');
          await new Promise((resolve, reject) => {
            const req = https.request({
              hostname: 'api.github.com',
              path: `/repos/${project.repository.owner}/${project.repository.repo}/hooks/${project.github.webhookId}`,
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Fluid-VPS-Portal' }
            }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
            req.on('error', reject);
            req.end();
          });
        } catch (err) {
          console.error('[Webhook] Delete error:', err.message);
        }
      }
    }

    await prisma.project.update({
      where: { id: project.id },
      data: {
        github: {
          ...(typeof project.github === 'object' ? project.github : {}),
          webhookId: null,
          webhookSecret: null,
          autoDeploy: false
        }
      }
    });

    return reply.send({ success: true, message: 'Webhook removed' });
  });
}
