import { getPrisma } from '../services/database.js';
import { authenticate } from '../middleware/auth.js';

export default async function projectRoutes(fastify) {
  fastify.get('/api/projects', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const projects = await prisma.project.findMany({
      where: { userId: request.user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        envVars: { select: { id: true, key: true, isSecret: true, description: true } },
        domains: true
      }
    });
    const sanitized = projects.map(p => ({
      ...p,
      envVars: p.envVars.map(e => ({ ...e, value: e.isSecret ? '••••••••' : e.value }))
    }));
    return reply.send({ success: true, projects: sanitized });
  });

  fastify.get('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null },
      include: { envVars: true, domains: true }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    return reply.send({ success: true, project });
  });

  fastify.post('/api/projects', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, repository, directory, framework } = request.body || {};
    const prisma = getPrisma();

    if (!name || !directory) {
      return reply.status(400).send({ success: false, error: 'Name and directory are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existingSlug = await prisma.project.findFirst({
      where: { slug, userId: request.user.id }
    });
    if (existingSlug) {
      return reply.status(400).send({ success: false, error: 'A project with this name already exists' });
    }

    const project = await prisma.project.create({
      data: {
        userId: request.user.id,
        name,
        slug,
        repository: repository || {},
        directory,
        framework: framework || 'custom',
        status: 'active'
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'project.create',
        category: 'project',
        description: `Created project ${name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.status(201).send({ success: true, project });
  });

  fastify.put('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const allowedFields = ['name', 'buildCommand', 'installCommand', 'startCommand', 'port', 'framework',
      'processManager', 'outputDirectory', 'nodeVersion', 'healthCheck', 'github', 'pm2Config'];

    const updateData = {};
    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        if (typeof request.body[field] === 'object' && !Array.isArray(request.body[field])) {
          updateData[field] = { ...(project[field] || {}), ...request.body[field] };
        } else {
          updateData[field] = request.body[field];
        }
      }
    }

    if (request.body.name && request.body.name !== project.name) {
      updateData.name = request.body.name;
      updateData.slug = request.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: updateData
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: updated.id,
        action: 'project.update',
        category: 'project',
        description: `Updated project ${updated.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, project: updated });
  });

  fastify.delete('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date(), status: 'archived' }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'project.delete',
        category: 'project',
        description: `Deleted project ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, message: 'Project deleted' });
  });

  fastify.get('/api/projects/:id/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const totalDeployments = await prisma.deployment.count({ where: { projectId: project.id } });
    const successfulDeployments = await prisma.deployment.count({ where: { projectId: project.id, status: 'success' } });
    const failedDeployments = await prisma.deployment.count({ where: { projectId: project.id, status: 'failed' } });
    const lastDeployment = await prisma.deployment.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({
      success: true,
      stats: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        lastDeployment,
        currentStatus: project.status,
        domainCount: await prisma.domain.count({ where: { projectId: project.id } }),
        envVarCount: await prisma.envVar.count({ where: { projectId: project.id } })
      }
    });
  });

  fastify.get('/api/projects/:id/deployments', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { logChunks: false }
      }),
      prisma.deployment.count({ where: { projectId: project.id } })
    ]);

    return reply.send({
      success: true,
      deployments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });
}
