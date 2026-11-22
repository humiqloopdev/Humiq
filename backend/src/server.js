import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import candidateRoutes from './routes/candidate.routes.js';
import employerRoutes from './routes/employer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler } from './middleware/errors.js';

const secret = process.env.JWT_SECRET || '';
if (secret.length < 32 || secret.startsWith('change-me')) {
  const msg = 'JWT_SECRET is missing, too short (<32 chars) or still the placeholder. Set a long random value in backend/.env.';
  if (process.env.NODE_ENV === 'production') { console.error(msg); process.exit(1); }
  console.warn('WARNING: ' + msg);
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json({ limit: '1mb' }));

const api = express.Router();
api.get('/health', (_req, res) => res.json({ status: 'ok' }));
api.use('/auth', authRoutes);
api.use(candidateRoutes);
api.use(employerRoutes);
api.use(adminRoutes);

app.use('/api/v1', api);
app.use((_req, res) => res.status(404).json({ detail: 'Not found.' }));
app.use(errorHandler);

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`API running at http://localhost:${port}/api/v1`));
