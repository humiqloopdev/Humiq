import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../services/auth.service.js';

const router = Router();
const ua = (req) => req.headers['user-agent'];

// Brute-force protection. Counted per client IP; failed and successful attempts both count.
const limiter = (max, windowMinutes, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { detail: message },
});
const loginLimit = limiter(Number(process.env.LOGIN_RATE_LIMIT || 20), 15, 'Too many sign-in attempts. Try again in 15 minutes.');
const registerLimit = limiter(Number(process.env.REGISTER_RATE_LIMIT || 10), 60, 'Too many sign-ups from this address. Try again later.');
const refreshLimit = limiter(Number(process.env.REFRESH_RATE_LIMIT || 120), 15, 'Too many token refreshes. Try again shortly.');

// Paths accept an optional trailing slash because the frontend calls /auth/login/
router.post('/login{/}', loginLimit, async (req, res) => res.json(await auth.login(req.body, ua(req))));

router.post('/register{/}', registerLimit, async (req, res) => res.status(201).json(await auth.register(req.body, ua(req))));

router.post('/token/refresh{/}', refreshLimit, async (req, res) => res.json(await auth.rotate(req.body?.refresh, ua(req))));

router.post('/logout{/}', async (req, res) => {
  await auth.logout(req.body?.refresh);
  res.status(204).end();
});

// Signs the user out of every device.
router.post('/logout-all{/}', requireAuth, async (req, res) => {
  await auth.revokeAllForUser(req.auth.sub);
  res.status(204).end();
});

router.get('/me{/}', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.auth.sub]);
  res.json(auth.publicUser(rows[0]));
});

export default router;
