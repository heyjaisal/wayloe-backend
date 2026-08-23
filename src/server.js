import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import env from './shared/config/env.js';
import connectDB from './shared/config/database.js';
import { corsOptions } from './shared/config/cors.js';
import logger from './shared/utils/logger.js';
import app from './app.js';

import Group from './features/groups/groups.model.js';
import Event from './features/events/events.model.js';

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled Rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

await connectDB();

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id, userId: socket.userId }, 'Client connected');

  socket.join(`user-${socket.userId}`);

  socket.on('join-group', async (groupId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) return;
      const group = await Group.findById(groupId).select('members createdBy').lean();
      if (!group) return;

      const isMember = group.createdBy.toString() === socket.userId ||
        group.members.some(m => m.toString() === socket.userId);

      if (isMember) {
        socket.join(`group-${groupId}`);
      }
    } catch (err) {
      logger.error({ err }, 'Socket join-group error');
    }
  });

  socket.on('leave-group', (groupId) => {
    socket.leave(`group-${groupId}`);
  });

  socket.on('join-events', () => {
    socket.join('events');
  });

  socket.on('leave-events', () => {
    socket.leave('events');
  });

  socket.on('join-event', async (eventId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(eventId)) return;
      const event = await Event.findById(eventId).select('attendees creator visibility').lean();
      if (!event) return;

      const isCreator = event.creator.toString() === socket.userId;
      const isAttendee = event.attendees?.some(
        a => a.userId.toString() === socket.userId && ['joined', 'approved', 'checked-in'].includes(a.status)
      );

      if (isCreator || isAttendee || event.visibility === 'public') {
        socket.join(`event-${eventId}`);
      }
    } catch (err) {
      logger.error({ err }, 'Socket join-event error');
    }
  });

  socket.on('leave-event', (eventId) => {
    socket.leave(`event-${eventId}`);
  });

  socket.on('share-location', (data) => {
    const room = data.eventId ? `event-${data.eventId}` : `group-${data.groupId}`;
    socket.to(room).emit('user-location-update', {
      ...data,
      userId: socket.userId,
    });
  });

  socket.on('stop-location-sharing', (data) => {
    const room = data.eventId ? `event-${data.eventId}` : `group-${data.groupId}`;
    socket.to(room).emit('user-location-stopped', { userId: socket.userId });
  });

  socket.on('location-update', () => {});

  socket.on('event-chat-message', (data) => {
    const room = data.groupId ? `group-${data.groupId}` : `event-${data.eventId}`;
    const message = {
      senderId: socket.userId,
      senderName: data.senderName,
      type: data.type || 'text',
      text: typeof data.text === 'string' ? data.text.slice(0, 2000) : '',
    };
    socket.to(room).emit('event-message', message);
  });

  socket.on('disconnect', () => {
    logger.debug({ socketId: socket.id }, 'Client disconnected');
  });
});

const shutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  io.close();

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing MongoDB');
  }

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server running');
});

export { app, server, io };
