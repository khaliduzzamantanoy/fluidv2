import Project from '../models/Project.js';
import Deployment from '../models/Deployment.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate } from '../middleware/auth.js';

export default async function projectRoutes(fastify) {
  // List all projects
  fastify.get('/api/projects', { preHandler: [authenticate] }, async (request, reply) => {
    const projects = await Project.find({ userId: request.user._id, deletedAt: null })
      .sort({ updatedAt: -1 })
      .select('-envVars.value');
    return reply.send({ success: true, projects });
  });

  // Get single project
  fastify.get('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    return reply.send({ success: true, project });
  });

  // Create project
  fastify.post('/api/projects', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, repository, directory, framework } = request.body || {};

    if (!name || !directory) {
      return reply.status(400).send({ success: false, error: 'Name and directory are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existingSlug = await Project.findOne({ slug, userId: request.user._id });
    if (existingSlug) {
      return reply.status(400).send({ success: false, error: 'A project with this name already exists' });
    }

    const project = await Project.create({
      userId: request.user._id,
      name,
      slug,
      repository: repository || {},
      directory,
      framework: framework || 'custom',
      status: 'active'
    });

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'project.create',
      category: 'project',
      description: `Created project ${name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.status(201).send({ success: true, project });
  });

  // Update project
  fastify.put('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const allowedFields = ['name', 'buildCommand', 'installCommand', 'startCommand', 'port', 'framework',
      'processManager', 'outputDirectory', 'nodeVersion', 'healthCheck', 'github', 'pm2Config'];

    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        if (typeof request.body[field] === 'object' && !Array.isArray(request.body[field])) {
          Object.assign(project[field], request.body[field]);
        } else {
          project[field] = request.body[field];
        }
      }
    }

    if (request.body.name && request.body.name !== project.name) {
      project.name = request.body.name;
      project.slug = request.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'project.update',
      category: 'project',
      description: `Updated project ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, project });
  });

  // Delete project (soft delete)
  fastify.delete('/api/projects/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    project.deletedAt = new Date();
    project.status = 'archived';
    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'project.delete',
      category: 'project',
      description: `Deleted project ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, message: 'Project deleted' });
  });

  // Project stats
  fastify.get('/api/projects/:id/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const totalDeployments = await Deployment.countDocuments({ projectId: project._id });
    const successfulDeployments = await Deployment.countDocuments({ projectId: project._id, status: 'success' });
    const failedDeployments = await Deployment.countDocuments({ projectId: project._id, status: 'failed' });
    const lastDeployment = await Deployment.findOne({ projectId: project._id }).sort({ createdAt: -1 });

    return reply.send({
      success: true,
      stats: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        lastDeployment,
        currentStatus: project.status,
        domainCount: project.domains?.length || 0,
        envVarCount: project.envVars?.length || 0
      }
    });
  });

  // List deployments for a project
  fastify.get('/api/projects/:id/deployments', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [deployments, total] = await Promise.all([
      Deployment.find({ projectId: project._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-logChunks'),
      Deployment.countDocuments({ projectId: project._id })
    ]);

    return reply.send({
      success: true,
      deployments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });
}