import { getTokenFromRequest, verifyToken } from '../services/auth.js';
import User from '../models/User.js';

export async function authenticate(request, reply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return reply.status(401).send({ success: false, error: 'User not found' });
  }

  request.user = user;
}

export async function optionalAuth(request, reply) {
  const token = getTokenFromRequest(request);
  if (!token) return;

  const decoded = verifyToken(token);
  if (!decoded) return;

  const user = await User.findById(decoded.id);
  if (user) {
    request.user = user;
  }
}