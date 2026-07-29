import { getPrisma } from '../services/database.js';
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
  fastify.get('/api/projects/:id/env', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const envVars = await prisma.envVar.findMany({ where: { projectId: project.id } });
    const sanitized = envVars.map(env => ({
      id: env.id,
      key: env.key,
      value: env.isSecret ? '••••••••' : decrypt(env.value),
      isSecret: env.isSecret,
      description: env.description
    }));

    return reply.send({ success: true, envVars: sanitized, count: sanitized.length });
  });

  fastify.post('/api/projects/:id/env', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { key, value, isSecret, description } = request.body || {};
    if (!key || value === undefined) {
      return reply.status(400).send({ success: false, error: 'Key and value are required' });
    }

    const existing = await prisma.envVar.findFirst({ where: { projectId: project.id, key } });
    if (existing) {
      return reply.status(400).send({ success: false, error: `Environment variable '${key}' already exists` });
    }

    await prisma.envVar.create({
      data: {
        projectId: project.id,
        key: key.trim(),
        value: encrypt(String(value)),
        isSecret: isSecret || false,
        description: description || ''
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'env.add',
        category: 'env',
        description: `Added environment variable ${key} to ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.status(201).send({ success: true, envVar: { key, isSecret, description } });
  });

  fastify.put('/api/projects/:id/env/:envId', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const env = await prisma.envVar.findFirst({ where: { id: request.params.envId, projectId: project.id } });
    if (!env) {
      return reply.status(404).send({ success: false, error: 'Environment variable not found' });
    }

    const { value, isSecret, description } = request.body || {};
    const updateData = {};

    if (value !== undefined) updateData.value = encrypt(String(value));
    if (isSecret !== undefined) updateData.isSecret = isSecret;
    if (description !== undefined) updateData.description = description;

    const updated = await prisma.envVar.update({ where: { id: env.id }, data: updateData });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'env.update',
        category: 'env',
        description: `Updated environment variable ${env.key} on ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, envVar: { id: updated.id, key: env.key, isSecret: updated.isSecret, description: updated.description } });
  });

  fastify.delete('/api/projects/:id/env/:envId', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const env = await prisma.envVar.findFirst({ where: { id: request.params.envId, projectId: project.id } });
    if (!env) {
      return reply.status(404).send({ success: false, error: 'Environment variable not found' });
    }

    await prisma.envVar.delete({ where: { id: env.id } });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'env.delete',
        category: 'env',
        description: `Deleted environment variable ${env.key} from ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, removed: env.key });
  });

  fastify.put('/api/projects/:id/env/bulk', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { vars } = request.body || {};
    if (!Array.isArray(vars)) {
      return reply.status(400).send({ success: false, error: 'vars must be an array of {key, value, isSecret, description}' });
    }

    for (const v of vars) {
      const existing = await prisma.envVar.findFirst({ where: { projectId: project.id, key: v.key } });
      if (existing) {
        await prisma.envVar.update({
          where: { id: existing.id },
          data: {
            value: encrypt(String(v.value)),
            ...(v.isSecret !== undefined ? { isSecret: v.isSecret } : {}),
            ...(v.description !== undefined ? { description: v.description } : {})
          }
        });
      } else {
        await prisma.envVar.create({
          data: {
            projectId: project.id,
            key: v.key.trim(),
            value: encrypt(String(v.value)),
            isSecret: v.isSecret || false,
            description: v.description || ''
          }
        });
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'env.bulk_update',
        category: 'env',
        description: `Bulk updated ${vars.length} environment variables for ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, count: vars.length });
  });
}
