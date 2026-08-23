import * as messagesService from './messages.service.js';

export const getMessages = async (req, res) => {
  const { before, limit } = req.query;
  const data = await messagesService.getMessages(req.params.groupId, req.user._id, {
    before,
    limit: parseInt(limit),
  });
  res.json({ success: true, data });
};

export const sendMessage = async (req, res) => {
  const io = req.app.get('io');
  const data = await messagesService.sendMessage(req.params.groupId, req.user._id, req.user, {
    type: req.body.type,
    text: req.body.text,
    imageUrl: req.body.imageUrl,
    favorite: req.body.favorite,
  }, io);
  res.status(201).json({ success: true, data });
};
