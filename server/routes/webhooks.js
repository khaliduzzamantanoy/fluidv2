import Project from '../models/Project.js';
import Deployment from '../models/Deployment.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import crypto from 'crypto';

export default async function webhookRoutes(fastify) {
  // GitHub webhook receiver
  fastify.post('/api/webhooks/github', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'];
    const event = request.headers['x-github-event'];
    const deliveryId = request.headers['x-github-delivery'];
    const payload = request.body;

    if (!payload || !payload.repository) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook payload' });
    }

    const repoFullName = payload.repository.full_name;
    const project = await Project.findOne({ 'repository.fullName': repoFullName, 'github.autoDeploy': true, deletedAt: null });

    if (!project) {
      // Log undelivered webhook
      await WebhookDelivery.create({
        webhookId: deliveryId,
        event,
        deliveryId,
        payload,
        status: 'failed',
        error: `No project found with auto-deploy enabled for ${repoFullName}`
      });
      return reply.status(200).send({ success: false, error: 'No matching project' });
    }

    // Verify signature
    if (project.github.webhookSecret) {
      const hmac = crypto.createHmac('sha256', project.github.webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
      if (signature !== digest) {
        await WebhookDelivery.create({
          projectId: project._id,
          webhookId: deliveryId,
          event,
          payload,
          deliveryId,
          signature,
          status: 'failed',
          error: 'Signature mismatch'
        });
        return reply.status(401).send({ success: false, error: 'Invalid signature' });
      }
    }

    const delivery = await WebhookDelivery.create({
      projectId: project._id,
      webhookId: deliveryId,
      event,
      payload,
      deliveryId,
      signature,
      status: 'pending'
    });

    try {
      let shouldDeploy = false;
      let deployBranch = null;
      let commitSha = null;
      let commitMessage = null;
      let prNumber = null;

      if (event === 'push' && payload.ref) {
        const branch = payload.ref.replace('refs/heads/', '');
        deployBranch = branch;

        if (project.github.branchFilters?.length > 0) {
          shouldDeploy = project.github.branchFilters.includes(branch);
        } else {
          shouldDeploy = branch === project.repository.branch;
        }

        if (project.github.ignorePaths?.length > 0 && payload.commits?.length > 0) {
          const lastCommit = payload.commits[payload.commits.length - 1];
          const modifiedFiles = [...(lastCommit.added || []), ...(lastCommit.modified || [])];
          const shouldIgnore = modifiedFiles.some(f =>
            project.github.ignorePaths.some(p => f.startsWith(p))
          );
          if (shouldIgnore && modifiedFiles.length > 0) {
            shouldDeploy = false;
          }
        }

        commitSha = payload.after;
        commitMessage = payload.head_commit?.message;
      } else if (event === 'pull_request' && project.github.deployPrs) {
        const action = payload.action;
        if (['opened', 'synchronize', 'reopened'].includes(action)) {
          shouldDeploy = true;
          prNumber = payload.number;
          deployBranch = payload.pull_request.head.ref;
          commitSha = payload.pull_request.head.sha;
          commitMessage = payload.pull_request.title;
        }
      }

      if (shouldDeploy) {
        const deployment = await Deployment.create({
          projectId: project._id,
          trigger: event === 'push' ? 'webhook_push' : 'webhook_pr',
          triggerMetadata: {
            commitSha,
            commitMessage: commitMessage || 'Webhook triggered deployment',
            branch: deployBranch,
            prNumber,
            author: {
              name: payload.sender?.login,
              avatar: payload.sender?.avatar_url
            },
            compareUrl: payload.compare
          },
          status: 'queued'
        });

        project.status = 'deploying';
        project.lastDeployedAt = new Date();
        project.deploymentCount += 1;
        await project.save();

        delivery.status = 'delivered';
        delivery.processedAt = new Date();
        delivery.responseBody = `Deployment created: ${deployment._id}`;
        await delivery.save();

        // Execute deployment in background
        const { executeDeployment } = await import('./deployments.js');
        executeDeployment(deployment._id, project).catch(err => {
          console.error('[Webhook] Deploy execution error:', err.message);
        });

        return reply.send({
          success: true,
          action: 'deployment_created',
          deploymentId: deployment._id,
          branch: deployBranch,
          commitSha
        });
      }

      delivery.status = 'delivered';
      delivery.processedAt = new Date();
      delivery.responseBody = 'Received but no deployment triggered';
      await delivery.save();

      return reply.send({
        success: true,
        action: 'received',
        reason: 'conditions_not_met',
        branch: deployBranch,
        event
      });

    } catch (err) {
      delivery.status = 'failed';
      delivery.error = err.message;
      await delivery.save();

      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // List webhook deliveries for a project
  fastify.get('/api/projects/:id/webhooks', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const project = await Project.findOne({ _id: request.params.id, userId: request.user?._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const deliveries = await WebhookDelivery.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return reply.send({ success: true, deliveries });
  });

  // Register GitHub webhook for a project
  fastify.post('/api/projects/:id/webhooks/register', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, error: 'Auth required' });

    const project = await Project.findOne({ _id: request.params.id, userId: user._id, deletedAt: null });
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

      project.github.webhookId = String(ghRes.data.id);
      project.github.webhookSecret = webhookSecret;
      project.github.autoDeploy = true;
      await project.save();

      return reply.send({
        success: true,
        webhook: { id: ghRes.data.id, url: ghRes.data.config.url, events: ghRes.data.events },
        project
      });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Remove GitHub webhook
  fastify.delete('/api/projects/:id/webhooks', async (request, reply) => {
    const { authenticate } = await import('../middleware/auth.js');
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, error: 'Auth required' });

    const project = await Project.findOne({ _id: request.params.id, userId: user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    if (project.github.webhookId && project.repository?.owner && project.repository?.repo) {
      const token = user.githubToken || process.env.GITHUB_TOKEN;
      if (token) {
        try {
          const https = await import('https');
          await new Promise((resolve, reject) => {
            const req = https.request({
              hostname: 'api.github.com',
              path: `/repos/${project.repository.owner}/${project.repository.repo}/hooks/${project.github.webhookId}`,
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Fluid-VPS-Portal'
              }
            }, (res) => {
              res.on('data', () => {});
              res.on('end', resolve);
            });
            req.on('error', reject);
            req.end();
          });
        } catch (err) {
          console.error('[Webhook] Delete error:', err.message);
        }
      }
    }

    project.github.webhookId = null;
    project.github.webhookSecret = null;
    project.github.autoDeploy = false;
    await project.save();

    return reply.send({ success: true, message: 'Webhook removed' });
  });
}