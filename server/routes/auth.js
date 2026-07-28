import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { generateToken, getTokenCookieOptions } from '../services/auth.js';

export default async function authRoutes(fastify) {
  // POST /api/auth/setup - Create first admin user
  fastify.post('/api/auth/setup', async (request, reply) => {
    const { username, password, email } = request.body || {};

    if (!username || !password) {
      return reply.status(400).send({ success: false, error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ success: false, error: 'Password must be at least 8 characters' });
    }

    const existingUserCount = await User.countDocuments();
    if (existingUserCount > 0) {
      return reply.status(400).send({ success: false, error: 'Admin user already exists. Use login instead.' });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return reply.status(400).send({ success: false, error: 'Username already taken' });
    }

    const user = await User.create({
      username: username.toLowerCase(),
      email: email?.toLowerCase(),
      passwordHash: password,
      fullName: username,
      role: 'owner'
    });

    const token = generateToken(user);

    reply.setCookie('token', token, getTokenCookieOptions());

    // Log activity
    await ActivityLog.create({
      userId: user._id,
      action: 'auth.first_user_setup',
      category: 'auth',
      description: 'First admin user created and portal initialized',
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({
      success: true,
      user: { id: user._id, username: user.username, role: user.role, email: user.email },
      token
    });
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return reply.status(400).send({ success: false, error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    reply.setCookie('token', token, getTokenCookieOptions());

    await ActivityLog.create({
      userId: user._id,
      action: 'auth.login',
      category: 'auth',
      description: `User ${user.username} logged in`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({
      success: true,
      user: { id: user._id, username: user.username, role: user.role, email: user.email },
      token
    });
  });

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ success: true });
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', async (request, reply) => {
    const token = request.cookies?.token || request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({ success: false, error: 'Not authenticated' });
    }

    const { verifyToken } = await import('../services/auth.js');
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.status(401).send({ success: false, error: 'Invalid token' });
    }

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return reply.status(401).send({ success: false, error: 'User not found' });
    }

    return reply.send({ success: true, user });
  });

  // GET /api/auth/check-setup
  fastify.get('/api/auth/check-setup', async (request, reply) => {
    const userCount = await User.countDocuments();
    return reply.send({
      success: true,
      needsSetup: userCount === 0,
      userCount
    });
  });

  // PUT /api/auth/change-password
  fastify.put('/api/auth/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {};

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ success: false, error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return reply.status(400).send({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(request.user._id);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return reply.status(401).send({ success: false, error: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      action: 'auth.change_password',
      category: 'security',
      description: 'Password changed',
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, message: 'Password changed successfully' });
  });

  // PUT /api/auth/settings
  fastify.put('/api/auth/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const { theme, notifications, timezone, fullName, email } = request.body || {};

    const updateFields = {};
    if (theme) updateFields['settings.theme'] = theme;
    if (notifications) updateFields['settings.notifications'] = notifications;
    if (timezone) updateFields['settings.timezone'] = timezone;
    if (fullName) updateFields.fullName = fullName;
    if (email !== undefined) {
      if (email) {
        const existingEmail = await User.findOne({ email: email.toLowerCase(), _id: { $ne: request.user._id } });
        if (existingEmail) {
          return reply.status(400).send({ success: false, error: 'Email already in use' });
        }
      }
      updateFields.email = email?.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(request.user._id, updateFields, { new: true }).select('-passwordHash');
    return reply.send({ success: true, user });
  });
}

// Import authenticate for use in routes
import { authenticate } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';