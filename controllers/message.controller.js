import Message from '../models/Message.js';
import Group from '../models/Group.js';
import { getIO } from '../services/realtime.service.js';
import logger from '../utils/logger.js';

export const getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { before, limit = 50 } = req.query;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const isMember = group.createdBy.toString() === userId.toString() ||
      group.members.some(m => m.toString() === userId.toString());

    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a member of this group' });
    }

    const query = { groupId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching messages');
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, text, imageUrl } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const isMember = group.createdBy.toString() === userId.toString() ||
      group.members.some(m => m.toString() === userId.toString());

    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a member of this group' });
    }

    const messageType = type || 'text';
    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }
    if (messageType === 'image' && !imageUrl) {
      return res.status(400).json({ success: false, error: 'Image URL is required' });
    }

    const message = await Message.create({
      groupId,
      senderId: userId,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      senderImage: req.user.profileImage || null,
      type: messageType,
      text: text?.trim(),
      imageUrl,
    });

    const io = getIO();
    if (io) {
      io.to(`group:${groupId}`).emit('new_message', { message });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    logger.error({ err: error }, 'Error sending message');
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
