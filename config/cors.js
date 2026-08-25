import cors from 'cors';
import env from './env.js';

const allowedOrigins = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim()) : [];

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow non-browser requests (e.g. Postman, cURL, health checks)
    if (!origin) return callback(null, true);

    // Development mode allows all origins
    if (env.NODE_ENV === 'development') return callback(null, true);

    // Explicitly allowed origins from environment variable
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Dynamic pattern matching for Vercel, Render, and custom wayloe domains
    try {
      const url = new URL(origin);
      if (
        url.hostname.endsWith('.vercel.app') ||
        url.hostname.endsWith('.onrender.com') ||
        url.hostname === 'wayloe.in' ||
        url.hostname.endsWith('.wayloe.in')
      ) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL format
    }

    return callback(new Error(`CORS error: Origin ${origin} is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

