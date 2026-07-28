import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fluid-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return null;
    }
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookie = request.cookies?.token;
  if (cookie) {
    return cookie;
  }

  return null;
}

export function getTokenCookieOptions() {
  const maxAge = 24 * 60 * 60 * 1000;
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge
  };
}

export { JWT_SECRET };