import Message from './messages.model.js';
import Group from '../groups/groups.model.js';
import { AppError } from '../../shared/middleware/errorHandler.js';

export const getMessages = async (groupId, userId, { before, limit }) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const isMember = group.createdBy.toString() === userId.toString() ||
    group.members.some(m => m.toString() === userId.toString());

  if (!isMember) {
    throw new AppError('Not a member of this group', 403);
  }

  const query = { groupId };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse();
};

export const sendMessage = async (groupId, userId, userData, messageData, io) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const isMember = group.createdBy.toString() === userId.toString() ||
    group.members.some(m => m.toString() === userId.toString());

  if (!isMember) {
    throw new AppError('Not a member of this group', 403);
  }

  const message = await Message.create({
    groupId,
    senderId: userId,
    senderName: userData.username,
    senderImage: userData.profileImage,
    type: messageData.type || 'text',
    text: messageData.text,
    imageUrl: messageData.imageUrl,
    favorite: messageData.favorite,
  });

  if (io) {
    io.to(`group-${groupId}`).emit('new-message', message);
  }

  return message;
};
