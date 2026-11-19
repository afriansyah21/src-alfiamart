import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema } from '../schemas.js';
import { unauthorized } from '../errors.js';

const router = Router();

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.valid.body;
    // Mendukung login dengan username maupun email
    const { rows } = await query(
      'SELECT id, name, username, email, role, password_hash FROM users WHERE lower(coalesce(username, \'\')) = lower($1) OR lower(coalesce(email, \'\')) = lower($1)',
      [username]
    );
    const user = rows[0];
    // Pesan sengaja sama agar tidak membocorkan apakah username terdaftar
    if (!user || !(await bcrypt.compare(password, user.password_hash))) throw unauthorized('Username atau kata sandi salah');
    const token = jwt.sign(
      { role: user.role, name: user.name, username: user.username },
      config.jwtSecret,
      { subject: user.id, expiresIn: config.jwtExpiresIn }
    );
    res.json({ success: true, data: { token, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } } });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, username, email, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) throw unauthorized('Akun tidak ditemukan');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

export default router;
