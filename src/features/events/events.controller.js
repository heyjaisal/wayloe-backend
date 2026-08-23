import * as eventsService from './events.service.js';

export const getEvents = async (req, res) => {
  const userId = req.user._id;
  const filters = req.query;
  const data = await eventsService.getEvents(userId, filters);
  res.json({ success: true, data });
};

export const getEventById = async (req, res) => {
  const data = await eventsService.getEventById(req.params.id, req.user._id);
  res.json({ success: true, data });
};

export const createEvent = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.createEvent(req.user._id, req.user, req.body, io);
  res.status(201).json({ success: true, data });
};

export const updateEvent = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.updateEvent(req.params.id, req.user._id, req.body, io);
  res.json({ success: true, data });
};

export const deleteEvent = async (req, res) => {
  const io = req.app.get('io');
  await eventsService.deleteEvent(req.params.id, req.user._id, io);
  res.json({ success: true, message: 'Event deleted successfully' });
};

export const updateEventStatus = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.updateEventStatus(req.params.id, req.user._id, req.body.eventStatus, io);
  res.json({ success: true, data });
};

export const joinEvent = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.joinEvent(req.params.id, req.user._id, req.user, io);
  res.json({ success: true, data });
};

export const leaveEvent = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.leaveEvent(req.params.id, req.user._id, req.user, io);
  res.json({ success: true, data });
};

export const cancelJoinRequest = async (req, res) => {
  const io = req.app.get('io');
  await eventsService.cancelJoinRequest(req.params.id, req.user._id, io);
  res.json({ success: true, message: 'Join request cancelled' });
};

export const removeAttendee = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.removeAttendee(req.params.id, req.user._id, req.body.userId, io);
  res.json({ success: true, data });
};

export const approveJoinRequest = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.approveJoinRequest(req.params.id, req.user._id, req.body.userId, io);
  res.json({ success: true, data });
};

export const rejectJoinRequest = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.rejectJoinRequest(req.params.id, req.user._id, req.body.userId, req.body.reason, io);
  res.json({ success: true, data });
};

export const checkIn = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.checkIn(req.params.id, req.user._id, req.user, {
    latitude: req.body.latitude,
    longitude: req.body.longitude,
  }, io);
  res.json({ success: true, data });
};

export const getEventAttendees = async (req, res) => {
  const data = await eventsService.getEventAttendees(req.params.id, req.user._id, req.query.status);
  res.json({ success: true, data });
};

export const getPendingRequests = async (req, res) => {
  const data = await eventsService.getPendingRequests(req.params.id, req.user._id);
  res.json({ success: true, data });
};

export const updateEventSettings = async (req, res) => {
  const data = await eventsService.updateEventSettings(req.params.id, req.user._id, req.body);
  res.json({ success: true, data });
};

export const getEventMessages = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const result = await eventsService.getEventMessages(req.params.eventId, req.user._id, parseInt(page), parseInt(limit));
  res.json({ success: true, ...result });
};

export const sendEventMessage = async (req, res) => {
  const io = req.app.get('io');
  const data = await eventsService.sendEventMessage(req.params.eventId, req.user._id, req.user, {
    text: req.body.text,
    type: req.body.type,
  }, io);
  res.status(201).json({ success: true, data });
};

export const markMessagesRead = async (req, res) => {
  const data = await eventsService.markMessagesRead(req.params.eventId, req.user._id);
  res.json({ success: true, data });
};
