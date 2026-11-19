import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized, forbidden } from '../errors.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, username: payload.username };
    next();
  } catch {
    next(unauthorized('Sesi tidak valid atau sudah berakhir, silakan login ulang'));
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

// Untuk layanan DS/AE: header X-Service-Key, atau login sebagai owner.
export function requireServiceKeyOrOwner(req, res, next) {
  const key = req.headers['x-service-key'];
  if (config.serviceApiKey && key && key === config.serviceApiKey) return next();
  return requireAuth(req, res, (err) => (err ? next(err) : requireRole('owner')(req, res, next)));
}
