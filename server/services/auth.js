import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const getJWTSecret = () => process.env.JWT_SECRET || 'fluid-dev-secret-change-in-production';
const getJWTExpiresIn = () => process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    getJWTSecret(),
    { expiresIn: getJWTExpiresIn() }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJWTSecret());
  } catch (err) {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    if (cookies.token) return cookies.token;
  }

  return null;
}

export function setTokenCookie(reply, token) {
  const cookieStr = serialize('token', token, {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 86400
  });
  reply.header('Set-Cookie', cookieStr);
}

export function clearTokenCookie(reply) {
  const cookieStr = serialize('token', '', {
    path: '/',
    maxAge: 0
  });
  reply.header('Set-Cookie', cookieStr);
}


