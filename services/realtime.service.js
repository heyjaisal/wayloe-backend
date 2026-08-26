import logger from '../utils/logger.js';

/**
 * Module-level Socket.IO server reference.
 * Populated once by initializeRealtime() called from config/socket.js.
 */
let io = null;

/**
 * Store the Socket.IO instance so publish functions can use it.
 * Call this once after Socket.IO is attached to the HTTP server.
 *
 * @param {import('socket.io').Server} ioInstance
 */
export function initializeRealtime(ioInstance) {
  io = ioInstance;
  logger.info('Realtime service initialized');
}

/**
 * Publish a favorite_created event to all members of the group room
 * (excluding the creator's own socket if desired — handled on the frontend
 * by deduplicating against the API response).
 *
 * @param {string|import('mongoose').Types.ObjectId} groupId
 * @param {object} favorite - The fully resolved favorite object (with signed image URLs)
 */
export function publishFavoriteCreated(groupId, favorite) {
  if (!io) {
    logger.warn({ groupId }, 'publishFavoriteCreated called before realtime was initialized — skipping');
    return;
  }

  try {
    const room = `group:${groupId}`;
    io.to(room).emit('favorite_created', { favorite });
    logger.info({ groupId, favoriteId: favorite._id }, 'favorite_created emitted to group room');
  } catch (err) {
    // A Socket.IO failure must never corrupt a successful MongoDB operation.
    logger.error({ err, groupId }, 'Failed to emit favorite_created — realtime publish error');
  }
}

/**
 * Publish a favorite_deleted event to all members of the group room.
 *
 * @param {string|import('mongoose').Types.ObjectId} groupId
 * @param {string|import('mongoose').Types.ObjectId} favoriteId
 */
export function publishFavoriteDeleted(groupId, favoriteId) {
  if (!io) {
    logger.warn({ groupId }, 'publishFavoriteDeleted called before realtime was initialized — skipping');
    return;
  }

  try {
    const room = `group:${groupId}`;
    io.to(room).emit('favorite_deleted', {
      favoriteId: favoriteId.toString(),
      groupId: groupId.toString(),
    });
    logger.info({ groupId, favoriteId }, 'favorite_deleted emitted to group room');
  } catch (err) {
    logger.error({ err, groupId, favoriteId }, 'Failed to emit favorite_deleted — realtime publish error');
  }
}
