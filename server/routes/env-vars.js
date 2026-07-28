import Project from '../models/Project.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate } from '../middleware/auth.js';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fluid-default-encryption-key-32-chars!';

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return ciphertext;
  }
}

export default async function envRoutes(fastify) {
  // List environment variables for a project
  fastify.get('/api/projects/:id/env', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const envVars = project.envVars.map(env => ({
      _id: env._id,
      key: env.key,
      value: env.isSecret ? '••••••••' : decrypt(env.value),
      isSecret: env.isSecret,
      description: env.description
    }));

    return reply.send({ success: true, envVars, count: envVars.length });
  });

  // Add environment variable
  fastify.post('/api/projects/:id/env', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { key, value, isSecret, description } = request.body || {};
    if (!key || value === undefined) {
      return reply.status(400).send({ success: false, error: 'Key and value are required' });
    }

    const existing = project.envVars.find(e => e.key === key);
    if (existing) {
      return reply.status(400).send({ success: false, error: `Environment variable '${key}' already exists` });
    }

    project.envVars.push({
      key: key.trim(),
      value: encrypt(String(value)),
      isSecret: isSecret || false,
      description: description || ''
    });

    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'env.add',
      category: 'env',
      description: `Added environment variable ${key} to ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.status(201).send({ success: true, envVar: { key, isSecret, description } });
  });

  // Update environment variable
  fastify.put('/api/projects/:id/env/:envId', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const env = project.envVars.id(request.params.envId);
    if (!env) {
      return reply.status(404).send({ success: false, error: 'Environment variable not found' });
    }

    const { value, isSecret, description } = request.body || {};

    if (value !== undefined) {
      env.value = encrypt(String(value));
    }
    if (isSecret !== undefined) env.isSecret = isSecret;
    if (description !== undefined) env.description = description;

    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'env.update',
      category: 'env',
      description: `Updated environment variable ${env.key} on ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, envVar: { _id: env._id, key: env.key, isSecret: env.isSecret, description: env.description } });
  });

  // Delete environment variable
  fastify.delete('/api/projects/:id/env/:envId', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const env = project.envVars.id(request.params.envId);
    if (!env) {
      return reply.status(404).send({ success: false, error: 'Environment variable not found' });
    }

    const key = env.key;
    project.envVars.pull({ _id: request.params.envId });
    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'env.delete',
      category: 'env',
      description: `Deleted environment variable ${key} from ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, removed: key });
  });

  // Bulk update environment variables
  fastify.put('/api/projects/:id/env/bulk', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { vars } = request.body || {};
    if (!Array.isArray(vars)) {
      return reply.status(400).send({ success: false, error: 'vars must be an array of {key, value, isSecret, description}' });
    }

    for (const v of vars) {
      const existing = project.envVars.find(e => e.key === v.key);
      if (existing) {
        existing.value = encrypt(String(v.value));
        if (v.isSecret !== undefined) existing.isSecret = v.isSecret;
        if (v.description !== undefined) existing.description = v.description;
      } else {
        project.envVars.push({
          key: v.key.trim(),
          value: encrypt(String(v.value)),
          isSecret: v.isSecret || false,
          description: v.description || ''
        });
      }
    }

    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'env.bulk_update',
      category: 'env',
      description: `Bulk updated ${vars.length} environment variables for ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, count: vars.length });
  });
}