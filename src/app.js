import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import env from './shared/config/env.js';
import { corsMiddleware } from './shared/config/cors.js';
import logger from './shared/utils/logger.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

import authRoutes from './features/auth/auth.routes.js';
import mapRoutes from './features/map/map.routes.js';
import uploadRoutes from './features/upload/upload.routes.js';
import groupRoutes from './features/groups/groups.routes.js';
import messageRoutes from './features/messages/messages.routes.js';
import eventRoutes from './features/events/events.routes.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(corsMiddleware);
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

const isDev = env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : env.RATE_LIMIT_WINDOW_MS,
  max: isDev ? 10000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: isDev ? () => false : () => false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});

if (!isDev) {
  app.use('/api', globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to Wayloe API' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/events', eventRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

export default app;
