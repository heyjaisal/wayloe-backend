import cors from 'cors';
import env from './env.js';

const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (env.NODE_ENV === 'development') return callback(null, true);
    if (!origin) return callback(new Error('Not allowed by CORS'));
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
