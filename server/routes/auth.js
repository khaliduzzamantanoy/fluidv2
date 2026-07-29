import { getPrisma } from '../services/database.js';
import { generateToken, setTokenCookie, clearTokenCookie, getTokenFromRequest } from '../services/auth.js';
import { authenticate } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/setup', async (request, reply) => {
    const { username, password, email } = request.body || {};
    const prisma = getPrisma();

    if (!username || !password) {
      return reply.status(400).send({ success: false, error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ success: false, error: 'Password must be at least 8 characters' });
    }

    const existingUserCount = await prisma.user.count();
    if (existingUserCount > 0) {
      return reply.status(400).send({ success: false, error: 'Admin user already exists. Use login instead.' });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      return reply.status(400).send({ success: false, error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email?.toLowerCase() || null,
        passwordHash,
        fullName: username,
        role: 'owner'
      }
    });

    const token = generateToken(user);
    setTokenCookie(reply, token);

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'auth.first_user_setup',
        category: 'auth',
        description: 'First admin user created and portal initialized',
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, email: user.email },
      token
    });
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};
    const prisma = getPrisma();

    if (!username || !password) {
      return reply.status(400).send({ success: false, error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateToken(user);
    setTokenCookie(reply, token);

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'auth.login',
        category: 'auth',
        description: `User ${user.username} logged in`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    const mustChangePassword = user.mustChangePassword === true;

    return reply.send({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, email: user.email, mustChangePassword },
      token,
      mustChangePassword
    });
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    clearTokenCookie(reply);
    return reply.send({ success: true });
  });

  fastify.get('/api/auth/me', async (request, reply) => {
    const token = getTokenFromRequest(request);
    if (!token) {
      return reply.status(401).send({ success: false, error: 'Not authenticated' });
    }

    const { verifyToken } = await import('../services/auth.js');
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.status(401).send({ success: false, error: 'Invalid token' });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { passwordHash: false }
    });
    if (!user) {
      return reply.status(401).send({ success: false, error: 'User not found' });
    }

    return reply.send({ success: true, user });
  });

  fastify.get('/api/auth/check-setup', async (request, reply) => {
    const prisma = getPrisma();
    const userCount = await prisma.user.count();
    return reply.send({
      success: true,
      needsSetup: userCount === 0,
      userCount
    });
  });

  fastify.put('/api/auth/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {};
    const prisma = getPrisma();

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ success: false, error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return reply.status(400).send({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ success: false, error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false }
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'auth.change_password',
        category: 'security',
        description: 'Password changed',
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, message: 'Password changed successfully' });
  });

  fastify.put('/api/auth/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const { theme, notifications, timezone, fullName, email } = request.body || {};
    const prisma = getPrisma();

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email !== undefined) {
      if (email) {
        const existingEmail = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), id: { not: request.user.id } }
        });
        if (existingEmail) {
          return reply.status(400).send({ success: false, error: 'Email already in use' });
        }
      }
      updateData.email = email?.toLowerCase() || null;
    }

    let currentSettings = {};
    try { currentSettings = JSON.parse(request.user.settings || '{}'); } catch { currentSettings = {}; }
    if (theme) currentSettings.theme = theme;
    if (notifications) currentSettings.notifications = notifications;
    if (timezone) currentSettings.timezone = timezone;
    updateData.settings = JSON.stringify(currentSettings);

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: updateData
    });

    return reply.send({ success: true, user });
  });
}
