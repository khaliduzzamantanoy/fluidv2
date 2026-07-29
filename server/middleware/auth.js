import { getTokenFromRequest, verifyToken } from '../services/auth.js';
import { getPrisma } from '../services/database.js';

export async function authenticate(request, reply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
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

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (user) {
    request.user = user;
  }
}
