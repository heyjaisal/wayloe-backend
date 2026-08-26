import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from './env.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { initializeRealtime } from '../services/realtime.service.js';
import logger from '../utils/logger.js';

/**
 * Replicates the same origin-allow logic from config/cors.js so Socket.IO
 * uses an identical policy — no wildcard "*", no separate CORS system.
 */
const allowedOrigins = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : [];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (env.NODE_ENV === 'development') return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (
      url.hostname.endsWith('.vercel.app') ||
      url.hostname.endsWith('.onrender.com') ||
      url.hostname === 'wayloe.in' ||
      url.hostname.endsWith('.wayloe.in')
    ) {
      return true;
    }
  } catch {
    // Invalid URL format — deny
  }

  return false;
}

/** Validates a 24-character hex MongoDB ObjectId string. */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/**
 * Attach Socket.IO to the existing HTTP server.
 * Called once from server.js after http.createServer(app).
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS error: Origin ${origin} is not allowed.`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Use WebSocket first, fall back to polling
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ──────────────────────────────────────────────
  // Verifies the JWT passed in socket.handshake.auth.token using the same
  // secret and logic as the REST protect middleware. User identity comes
  // exclusively from the verified JWT — never from untrusted socket data.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      logger.warn({ socketId: socket.id }, 'Socket connection rejected — no token provided');
      return next(new Error('Authentication error: no token provided'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        logger.warn({ socketId: socket.id }, 'Socket connection rejected — user not found');
        return next(new Error('Authentication error: user not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      // Do not log the token itself — it is redacted by Pino config anyway,
      // but being explicit here is safer.
      logger.warn({ socketId: socket.id, errName: err.name }, 'Socket connection rejected — invalid token');
      next(new Error('Authentication error: invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    logger.info({ socketId: socket.id, userId }, 'Socket connected');

    // ── join_group ───────────────────────────────────────────────────────────
    // The client requests to subscribe to a group room.
    // The server verifies membership before joining — clients cannot freely
    // subscribe to arbitrary groups by knowing the groupId.
    socket.on('join_group', async ({ groupId } = {}) => {
      if (!isValidObjectId(groupId)) {
        logger.warn({ socketId: socket.id, userId, groupId }, 'join_group rejected — invalid groupId format');
        socket.emit('error', { message: 'Invalid group ID format' });
        return;
      }

      try {
        const group = await Group.findById(groupId);

        if (!group) {
          logger.warn({ socketId: socket.id, userId, groupId }, 'join_group rejected — group not found');
          socket.emit('error', { message: 'Group not found' });
          return;
        }

        const isMember = group.members.some((m) => m.toString() === userId);

        if (!isMember) {
          logger.warn({ socketId: socket.id, userId, groupId }, 'join_group rejected — user is not a member');
          socket.emit('error', { message: 'Not authorized to join this room' });
          return;
        }

        const room = `group:${groupId}`;
        await socket.join(room);
        socket.emit('joined_group', { groupId });
        logger.info({ socketId: socket.id, userId, groupId, room }, 'Socket joined group room');
      } catch (err) {
        logger.error({ err, socketId: socket.id, userId, groupId }, 'Error processing join_group');
        socket.emit('error', { message: 'Failed to join group room' });
      }
    });

    // ── leave_group ──────────────────────────────────────────────────────────
    socket.on('leave_group', ({ groupId } = {}) => {
      if (!isValidObjectId(groupId)) return;

      const room = `group:${groupId}`;
      socket.leave(room);
      logger.info({ socketId: socket.id, userId, groupId, room }, 'Socket left group room');
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    // Socket.IO automatically removes the socket from all rooms on disconnect.
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Socket disconnected');
    });
  });

  // Make the io instance available to the realtime service for publishing.
  initializeRealtime(io);

  logger.info('Socket.IO attached to HTTP server');
  return io;
}
