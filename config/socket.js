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

    // ── start_live_location ──────────────────────────────────────────────────
    // Client requests to start broadcasting their GPS position to the group.
    // Server verifies group membership before allowing.
    socket.on('start_live_location', async ({ groupId } = {}) => {
      if (!isValidObjectId(groupId)) {
        socket.emit('error', { message: 'Invalid group ID format' });
        return;
      }

      try {
        const group = await Group.findById(groupId);
        if (!group) {
          socket.emit('error', { message: 'Group not found' });
          return;
        }

        const isMember = group.members.some((m) => m.toString() === userId);
        if (!isMember) {
          logger.warn({ socketId: socket.id, userId, groupId }, 'start_live_location rejected — not a member');
          socket.emit('error', { message: 'Not authorized for this group' });
          return;
        }

        // Tag this socket so location_update events can verify the groupId
        // without a DB lookup on every position update.
        socket.liveGroupId = groupId;

        // Ensure the socket is in the group room (idempotent with join_group).
        const room = `group:${groupId}`;
        await socket.join(room);

        // Broadcast to ALL room members including the sender so the sender's
        // own liveMembers map stays consistent (socket.to excludes the sender).
        io.to(room).emit('member_started_sharing', {
          userId,
          user: {
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            profileImage: socket.user.profileImage || null,
          },
        });

        logger.info({ socketId: socket.id, userId, groupId }, 'Live location sharing started');
      } catch (err) {
        logger.error({ err, socketId: socket.id, userId, groupId }, 'Error processing start_live_location');
        socket.emit('error', { message: 'Failed to start live location' });
      }
    });

    // ── location_update ──────────────────────────────────────────────────────
    // Client sends a throttled GPS position. Server validates the groupId
    // against socket.liveGroupId (set in start_live_location) so a client
    // cannot spoof coordinates to an arbitrary group room.
    // No per-update logging to avoid flooding the log.
    socket.on('location_update', ({ groupId, lat, lng, timestamp } = {}) => {
      // Validate the groupId matches the one the socket registered for.
      if (!socket.liveGroupId || socket.liveGroupId !== groupId) return;

      // Basic coordinate sanity check.
      if (
        typeof lat !== 'number' || lat < -90 || lat > 90 ||
        typeof lng !== 'number' || lng < -180 || lng > 180
      ) return;

      const room = `group:${groupId}`;
      // Broadcast to everyone in the room including the sender so they can
      // see themselves on the map if desired; frontend deduplicates using userId.
      io.to(room).emit('member_location', {
        userId,
        lat,
        lng,
        timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
      });
    });

    // ── stop_live_location ───────────────────────────────────────────────────
    socket.on('stop_live_location', ({ groupId } = {}) => {
      const activeGroupId = socket.liveGroupId;
      if (!activeGroupId) return;

      socket.liveGroupId = null;

      const room = `group:${activeGroupId}`;
      // Broadcast to ALL room members including the sender so their own marker
      // is removed from their local map (socket.to would exclude the sender).
      io.to(room).emit('member_stopped_sharing', { userId });
      logger.info({ socketId: socket.id, userId, groupId: activeGroupId }, 'Live location sharing stopped');
    });

    // ── start_navigation ─────────────────────────────────────────────────────
    // Client starts solo route navigation. Joins their personal nav room.
    socket.on('start_navigation', () => {
      const navRoom = `nav:${userId}`;
      socket.join(navRoom);
      socket.isNavigating = true;
      logger.info({ socketId: socket.id, userId }, 'Solo navigation started');
    });

    // ── nav_location_update ──────────────────────────────────────────────────
    // Client sends throttled GPS position during solo navigation.
    socket.on('nav_location_update', ({ lat, lng, heading, timestamp } = {}) => {
      if (!socket.isNavigating) return;

      if (
        typeof lat !== 'number' || lat < -90 || lat > 90 ||
        typeof lng !== 'number' || lng < -180 || lng > 180
      ) return;

      const navRoom = `nav:${userId}`;
      // Echo back to the same user's sockets (e.g. other tabs) — also
      // consumed by the same client for marker update confirmation.
      io.to(navRoom).emit('nav_position', {
        lat,
        lng,
        heading: typeof heading === 'number' ? heading : null,
        timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
      });
    });

    // ── stop_navigation ──────────────────────────────────────────────────────
    socket.on('stop_navigation', () => {
      if (!socket.isNavigating) return;
      socket.isNavigating = false;
      const navRoom = `nav:${userId}`;
      socket.leave(navRoom);
      logger.info({ socketId: socket.id, userId }, 'Solo navigation stopped');
    });

    // ── disconnect ───────────────────────────────────────────────────────────

    // If this socket was sharing live location, auto-broadcast stop so other
    // members' markers disappear cleanly without waiting for a timeout.
    socket.on('disconnect', (reason) => {
      if (socket.liveGroupId) {
        const room = `group:${socket.liveGroupId}`;
        // Use io.to instead of socket.to — socket has already left all rooms.
        io.to(room).emit('member_stopped_sharing', { userId });
        logger.info({ socketId: socket.id, userId, groupId: socket.liveGroupId }, 'Live location auto-stopped on disconnect');
      }
      logger.info({ socketId: socket.id, userId, reason }, 'Socket disconnected');
    });
  });

  // Make the io instance available to the realtime service for publishing.
  initializeRealtime(io);

  logger.info('Socket.IO attached to HTTP server');
  return io;
}
