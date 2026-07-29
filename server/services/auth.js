import jwt from 'jsonwebtoken';

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

  const cookie = request.cookies?.token;
  if (cookie) {
    return cookie;
  }

  return null;
}

export function getTokenCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 86400
  };
}


