import Event from './events.model.js';
import EventMessage from './events-message.model.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import logger from '../../shared/utils/logger.js';

const ACTIVE_ATTENDEE_STATUSES = ['joined', 'approved', 'checked-in'];

const VALID_STATUS_TRANSITIONS = {
  upcoming: ['ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function canTransitionEventStatus(current, next) {
  return VALID_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

function emitToEventRoom(io, event, eventName, payload) {
  if (!io) return;
  const room = event.groupId ? `group-${event.groupId}` : `event-${event._id}`;
  io.to(room).emit(eventName, payload);
}

async function createSystemMessage(eventId, systemEvent, io) {
  try {
    const message = await EventMessage.create({
      eventId,
      senderId: null,
      senderName: 'System',
      type: 'system',
      text: systemEvent,
      systemEvent,
    });
    if (io) {
      io.to(`event-${eventId}`).emit('event-message', {
        _id: message._id,
        eventId,
        senderId: null,
        senderName: 'System',
        type: 'system',
        systemEvent,
        text: systemEvent,
        createdAt: message.createdAt,
      });
    }
    return message;
  } catch (err) {
    logger.error({ err }, 'Failed to create system message');
    return null;
  }
}

export const getEvents = async (userId, filters) => {
  const { groupId, lat, lng, radius, status, category, myEvents } = filters;

  let query = {};

  if (groupId) {
    query.groupId = groupId;
  } else if (myEvents) {
    query.$or = [
      { creator: userId },
      { 'attendees.userId': userId },
    ];
  } else {
    query.$or = [
      { creator: userId },
      { 'attendees.userId': userId },
      { visibility: 'public' },
    ];
  }

  if (status) query.eventStatus = status;
  if (category) query.category = category;

  if (lat && lng && radius) {
    query.location = {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius / 6378100],
      },
    };
  }

  const events = await Event.find(query).sort({ startDate: 1 }).limit(100);

  return events.map(e => {
    const obj = e.toObject();
    obj.id = obj._id;
    const attendee = e.findAttendee(userId);
    obj.currentUserStatus = attendee ? attendee.status : null;
    return obj;
  });
};

export const getEventById = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const isCreator = event.creator.toString() === userIdStr;
  const isAttendee = event.isUserAttending(userIdStr);

  if (event.visibility === 'private' && !isCreator && !isAttendee) {
    throw new AppError('Event not found', 404);
  }

  if (event.visibility === 'friends' && !isCreator && !isAttendee) {
    throw new AppError('Event not found', 404);
  }

  const computedStatus = event.computeStatus();
  if (event.eventStatus !== computedStatus && event.eventStatus !== 'cancelled') {
    event.eventStatus = computedStatus;
    await event.save();
  }

  const obj = event.toObject();
  obj.id = obj._id;
  const attendee = event.findAttendee(userId);
  obj.currentUserStatus = attendee ? attendee.status : null;

  return obj;
};

export const createEvent = async (userId, userData, eventData, io) => {
  const data = {
    creator: userId,
    creatorName: userData.username,
    creatorImage: userData.profileImage || null,
    groupId: eventData.groupId || null,
    title: eventData.title,
    description: eventData.description || '',
    location: { type: 'Point', coordinates: [eventData.longitude, eventData.latitude] },
    address: eventData.address || '',
    coverImage: eventData.coverImage || null,
    category: eventData.category || 'other',
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    maxAttendees: eventData.maxAttendees || null,
    visibility: eventData.visibility || 'public',
    joinPolicy: eventData.joinPolicy || 'auto',
    tags: eventData.tags || [],
    attendees: [{
      userId,
      username: userData.username,
      profileImage: userData.profileImage || null,
      status: 'joined',
      joinedAt: new Date(),
    }],
  };

  if (eventData.settings) {
    data.settings = {};
    if (typeof eventData.settings.chatEnabled === 'boolean') data.settings.chatEnabled = eventData.settings.chatEnabled;
    if (typeof eventData.settings.liveLocationEnabled === 'boolean') data.settings.liveLocationEnabled = eventData.settings.liveLocationEnabled;
    if (typeof eventData.settings.checkInEnabled === 'boolean') data.settings.checkInEnabled = eventData.settings.checkInEnabled;
    if (typeof eventData.settings.checkInRadius === 'number') data.settings.checkInRadius = eventData.settings.checkInRadius;
  }

  const event = await Event.create(data);

  await createSystemMessage(event._id, 'event-created', io);

  if (io) {
    const payload = { ...event.toObject(), id: event._id };
    emitToEventRoom(io, event, 'event-created', { event: payload, createdBy: userId });
    io.to('events').emit('event-created', { event: payload, createdBy: userId });
  }

  logger.info({ eventId: event._id, userId }, 'Event created');

  return { ...event.toObject(), id: event._id };
};

export const updateEvent = async (eventId, userId, updateData, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can update this event', 403);
  }

  const allowed = [
    'title', 'description', 'address', 'coverImage',
    'category', 'startDate', 'endDate', 'maxAttendees',
    'visibility', 'joinPolicy', 'tags',
  ];

  allowed.forEach(field => {
    if (updateData[field] !== undefined) {
      event[field] = updateData[field];
    }
  });

  if (updateData.latitude && updateData.longitude) {
    event.location = { type: 'Point', coordinates: [updateData.longitude, updateData.latitude] };
  }

  if (updateData.settings) {
    if (!event.settings) event.settings = {};
    const s = updateData.settings;
    if (typeof s.chatEnabled === 'boolean') event.settings.chatEnabled = s.chatEnabled;
    if (typeof s.liveLocationEnabled === 'boolean') event.settings.liveLocationEnabled = s.liveLocationEnabled;
    if (typeof s.checkInEnabled === 'boolean') event.settings.checkInEnabled = s.checkInEnabled;
    if (typeof s.checkInRadius === 'number') event.settings.checkInRadius = s.checkInRadius;
  }

  await event.save();

  await createSystemMessage(event._id, 'event-updated', io);

  if (io) {
    const payload = { ...event.toObject(), id: event._id };
    emitToEventRoom(io, event, 'event-updated', { event: payload, updatedBy: userId });
    io.to('events').emit('event-updated', { event: payload, updatedBy: userId });
  }

  return { ...event.toObject(), id: event._id };
};

export const deleteEvent = async (eventId, userId, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can delete this event', 403);
  }

  await Event.findByIdAndDelete(eventId);
  await EventMessage.deleteMany({ eventId });

  if (io) {
    const payload = { eventId, deletedBy: userId };
    emitToEventRoom(io, event, 'event-deleted', payload);
    io.to('events').emit('event-deleted', payload);
  }

  logger.info({ eventId, userId }, 'Event deleted');
};

export const updateEventStatus = async (eventId, userId, eventStatus, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can change event status', 403);
  }

  if (!canTransitionEventStatus(event.eventStatus, eventStatus)) {
    throw new AppError(`Cannot transition from "${event.eventStatus}" to "${eventStatus}"`, 400);
  }

  event.eventStatus = eventStatus;
  await event.save();

  const systemEvent = eventStatus === 'cancelled' ? 'event-cancelled' : `event-${eventStatus}`;
  await createSystemMessage(event._id, systemEvent, io);

  emitToEventRoom(io, event, 'event-status-changed', {
    eventId: event._id,
    eventStatus,
    changedBy: userId,
  });

  return { ...event.toObject(), id: event._id };
};

export const joinEvent = async (eventId, userId, userData, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.eventStatus === 'cancelled') {
    throw new AppError('Cannot join a cancelled event', 400);
  }

  if (event.eventStatus === 'completed') {
    throw new AppError('Cannot join a completed event', 400);
  }

  const userIdStr = userId.toString();
  const existing = event.findAttendee(userIdStr);

  if (existing) {
    if (ACTIVE_ATTENDEE_STATUSES.includes(existing.status)) {
      throw new AppError('Already a member of this event', 409);
    }
    if (existing.status === 'pending') {
      throw new AppError('Join request already pending', 409);
    }
    if (existing.status === 'rejected') {
      throw new AppError('Your previous request was rejected. Contact the event creator to request access.', 403);
    }
    if (existing.status === 'cancelled') {
      if (!event.hasCapacity()) {
        throw new AppError('Event is full', 400);
      }

      const newStatus = event.joinPolicy === 'auto' ? 'joined' : 'pending';
      existing.status = newStatus;
      existing.requestedAt = new Date();
      existing.joinedAt = newStatus === 'joined' ? new Date() : null;
      existing.approvedAt = null;
      existing.approvedBy = null;
      existing.rejectedAt = null;
      existing.rejectedBy = null;
      existing.rejectionReason = null;
      existing.checkedInAt = null;
      existing.checkedInLocation = undefined;
      await event.save();

      await createSystemMessage(event._id, 'member-joined', io);
      emitToEventRoom(io, event, 'event-joined', {
        eventId: event._id, userId: userIdStr, username: userData.username, status: newStatus,
      });

      return { ...event.toObject(), id: event._id };
    }
  }

  if (!event.hasCapacity()) {
    throw new AppError('Event is full', 400);
  }

  const status = event.joinPolicy === 'auto' ? 'joined' : 'pending';

  event.attendees.push({
    userId: userIdStr,
    username: userData.username,
    profileImage: userData.profileImage || null,
    status,
    requestedAt: new Date(),
    joinedAt: status === 'joined' ? new Date() : null,
  });

  await event.save();

  await createSystemMessage(event._id, 'member-joined', io);
  emitToEventRoom(io, event, 'event-joined', {
    eventId: event._id, userId: userIdStr, username: userData.username, status,
  });

  return { ...event.toObject(), id: event._id };
};

export const leaveEvent = async (eventId, userId, userData, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const attendeeIndex = event.attendees.findIndex(a => a.userId.toString() === userIdStr);

  if (attendeeIndex === -1) {
    throw new AppError('Not a member of this event', 400);
  }

  if (event.creator.toString() === userIdStr) {
    throw new AppError('Creator cannot leave their own event. Delete it instead.', 400);
  }

  const attendee = event.attendees[attendeeIndex];

  if (attendee.status === 'pending') {
    event.attendees.splice(attendeeIndex, 1);
  } else {
    attendee.status = 'cancelled';
    attendee.checkedInAt = null;
    attendee.checkedInLocation = undefined;
  }

  await event.save();

  await createSystemMessage(event._id, 'member-left', io);
  emitToEventRoom(io, event, 'event-left', {
    eventId: event._id, userId: userIdStr, username: userData.username,
  });

  return { ...event.toObject(), id: event._id };
};

export const cancelJoinRequest = async (eventId, userId, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const attendee = event.findAttendee(userIdStr);

  if (!attendee) {
    throw new AppError('No join request found', 404);
  }

  if (attendee.status !== 'pending') {
    throw new AppError('Only pending requests can be cancelled', 400);
  }

  event.attendees = event.attendees.filter(a => a.userId.toString() !== userIdStr);
  await event.save();

  emitToEventRoom(io, event, 'event-join-cancelled', {
    eventId: event._id, userId: userIdStr, username: userData.username,
  });
};

export const removeAttendee = async (eventId, userId, targetUserId, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can remove attendees', 403);
  }

  if (!targetUserId) {
    throw new AppError('userId is required', 400);
  }

  if (targetUserId === userId.toString()) {
    throw new AppError('Creator cannot remove themselves', 400);
  }

  const attendeeIndex = event.attendees.findIndex(a => a.userId.toString() === targetUserId);
  if (attendeeIndex === -1) {
    throw new AppError('User is not in the attendees list', 404);
  }

  const attendee = event.attendees[attendeeIndex];
  if (attendee.status === 'pending') {
    event.attendees.splice(attendeeIndex, 1);
  } else {
    attendee.status = 'cancelled';
    attendee.checkedInAt = null;
    attendee.checkedInLocation = undefined;
  }

  await event.save();

  await createSystemMessage(event._id, 'member-left', io);

  if (io) {
    io.to(`user-${targetUserId}`).emit('event-removed', {
      eventId: event._id, eventTitle: event.title, removedBy: userId,
    });
  }

  emitToEventRoom(io, event, 'event-attendee-removed', {
    eventId: event._id, userId: targetUserId, removedBy: userId,
  });

  if (io) {
    const payload = { ...event.toObject(), id: event._id };
    emitToEventRoom(io, event, 'event-updated', { event: payload, updatedBy: userId });
    io.to('events').emit('event-updated', { event: payload, updatedBy: userId });
  }

  return { ...event.toObject(), id: event._id };
};

export const approveJoinRequest = async (eventId, userId, targetUserId, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can approve join requests', 403);
  }

  if (!targetUserId) {
    throw new AppError('userId is required', 400);
  }

  const attendee = event.findAttendee(targetUserId);
  if (!attendee) {
    throw new AppError('User not found in attendees list', 404);
  }

  if (attendee.status !== 'pending') {
    throw new AppError(`Cannot approve a user with status "${attendee.status}". Only pending requests can be approved.`, 400);
  }

  if (!event.hasCapacity()) {
    throw new AppError('Event is full. Cannot approve more attendees.', 400);
  }

  attendee.status = 'approved';
  attendee.approvedAt = new Date();
  attendee.approvedBy = userId;
  attendee.joinedAt = new Date();
  await event.save();

  await createSystemMessage(event._id, 'member-approved', io);

  if (io) {
    io.to(`user-${targetUserId}`).emit('event-approved', {
      eventId: event._id, eventTitle: event.title, approvedBy: userId,
    });
  }

  emitToEventRoom(io, event, 'event-attendee-approved', {
    eventId: event._id, userId: targetUserId, approvedBy: userId,
  });

  if (io) {
    const payload = { ...event.toObject(), id: event._id };
    emitToEventRoom(io, event, 'event-updated', { event: payload, updatedBy: userId });
    io.to('events').emit('event-updated', { event: payload, updatedBy: userId });
  }

  return { ...event.toObject(), id: event._id };
};

export const rejectJoinRequest = async (eventId, userId, targetUserId, reason, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can reject join requests', 403);
  }

  if (!targetUserId) {
    throw new AppError('userId is required', 400);
  }

  const attendee = event.findAttendee(targetUserId);
  if (!attendee) {
    throw new AppError('User not found in attendees list', 404);
  }

  if (attendee.status !== 'pending') {
    throw new AppError(`Cannot reject a user with status "${attendee.status}". Only pending requests can be rejected.`, 400);
  }

  attendee.status = 'rejected';
  attendee.rejectedAt = new Date();
  attendee.rejectedBy = userId;
  attendee.rejectionReason = reason || null;
  await event.save();

  await createSystemMessage(event._id, 'member-rejected', io);

  if (io) {
    io.to(`user-${targetUserId}`).emit('event-rejected', {
      eventId: event._id, eventTitle: event.title, reason: reason || null,
    });
  }

  emitToEventRoom(io, event, 'event-attendee-rejected', {
    eventId: event._id, userId: targetUserId, rejectedBy: userId,
  });

  if (io) {
    const payload = { ...event.toObject(), id: event._id };
    emitToEventRoom(io, event, 'event-updated', { event: payload, updatedBy: userId });
    io.to('events').emit('event-updated', { event: payload, updatedBy: userId });
  }

  return { ...event.toObject(), id: event._id };
};

export const checkIn = async (eventId, userId, userData, { latitude, longitude }, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.settings?.checkInEnabled) {
    throw new AppError('Check-in is not enabled for this event', 400);
  }

  if (event.eventStatus === 'completed' || event.eventStatus === 'cancelled') {
    throw new AppError('Cannot check in to a completed or cancelled event', 400);
  }

  const userIdStr = userId.toString();
  const attendee = event.findAttendee(userIdStr);

  if (!attendee) {
    throw new AppError('Must join event before checking in', 400);
  }

  if (!ACTIVE_ATTENDEE_STATUSES.includes(attendee.status)) {
    throw new AppError(`Cannot check in with status "${attendee.status}"`, 400);
  }

  if (attendee.status === 'checked-in') {
    throw new AppError('Already checked in', 400);
  }

  const checkInRadius = event.settings?.checkInRadius || 100;
  const eventLat = event.location.coordinates[1];
  const eventLng = event.location.coordinates[0];

  const R = 6371e3;
  const phi1 = (latitude * Math.PI) / 180;
  const phi2 = (eventLat * Math.PI) / 180;
  const deltaPhi = ((eventLat - latitude) * Math.PI) / 180;
  const deltaLambda = ((eventLng - longitude) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 +
           Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  if (distance > checkInRadius) {
    throw new AppError(
      `You must be within ${checkInRadius}m to check in. Current distance: ${Math.round(distance)}m`,
      400
    );
  }

  attendee.status = 'checked-in';
  attendee.checkedInAt = new Date();
  attendee.checkedInLocation = { type: 'Point', coordinates: [longitude, latitude] };
  await event.save();

  await createSystemMessage(event._id, 'member-checked-in', io);

  emitToEventRoom(io, event, 'event-checked-in', {
    eventId: event._id, userId: userIdStr, username: userData.username,
  });

  return { ...event.toObject(), id: event._id };
};

export const getEventAttendees = async (eventId, userId, status) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const isCreator = event.creator.toString() === userIdStr;
  const isAttendee = event.isUserAttending(userIdStr);

  if (event.visibility === 'private' && !isCreator && !isAttendee) {
    throw new AppError('Event not found', 404);
  }

  let attendees = event.attendees;

  if (status === 'all' && isCreator) {
    // Return all
  } else if (status) {
    attendees = attendees.filter(a => a.status === status);
  } else {
    attendees = attendees.filter(a => ACTIVE_ATTENDEE_STATUSES.includes(a.status));
  }

  return attendees;
};

export const getPendingRequests = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can view pending requests', 403);
  }

  return event.attendees.filter(a => a.status === 'pending');
};

export const updateEventSettings = async (eventId, userId, settings) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.creator.toString() !== userId.toString()) {
    throw new AppError('Only the creator can update event settings', 403);
  }

  const { chatEnabled, liveLocationEnabled, checkInEnabled, checkInRadius } = settings;

  if (!event.settings) event.settings = {};
  if (typeof chatEnabled === 'boolean') event.settings.chatEnabled = chatEnabled;
  if (typeof liveLocationEnabled === 'boolean') event.settings.liveLocationEnabled = liveLocationEnabled;
  if (typeof checkInEnabled === 'boolean') event.settings.checkInEnabled = checkInEnabled;
  if (typeof checkInRadius === 'number') event.settings.checkInRadius = checkInRadius;

  await event.save();

  return { ...event.toObject(), id: event._id };
};

export const getEventMessages = async (eventId, userId, page = 1, limit = 50) => {
  const skip = (page - 1) * limit;

  const event = await Event.findById(eventId).select('creator attendees visibility');
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const isCreator = event.creator.toString() === userIdStr;
  const isAttendee = event.isUserAttending(userIdStr);

  if (event.visibility === 'private' && !isCreator && !isAttendee) {
    throw new AppError('Event not found', 404);
  }

  const messages = await EventMessage.find({ eventId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    data: messages.reverse(),
    pagination: { page, hasMore: messages.length === limit },
  };
};

export const sendEventMessage = async (eventId, userId, userData, { text, type }, io) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const userIdStr = userId.toString();
  const isCreator = event.creator.toString() === userIdStr;

  if (type === 'announcement' && !isCreator) {
    throw new AppError('Only the event host can send announcements', 403);
  }

  if (type !== 'announcement') {
    if (event.settings?.chatEnabled === false) {
      throw new AppError('Chat is disabled for this event', 403);
    }
    const attendee = event.findAttendee(userIdStr);
    if (!attendee || !ACTIVE_ATTENDEE_STATUSES.includes(attendee.status)) {
      throw new AppError('Only event members can send messages', 403);
    }
  }

  const messageType = type === 'announcement' ? 'announcement' : 'text';

  const message = await EventMessage.create({
    eventId,
    senderId: userId,
    senderName: userData.username,
    senderImage: userData.profileImage || null,
    type: messageType,
    text: text.trim(),
  });

  if (io) {
    const room = event.groupId ? `group-${event.groupId}` : `event-${eventId}`;
    io.to(room).emit('event-message', {
      _id: message._id,
      eventId,
      senderId: userId,
      senderName: userData.username,
      senderImage: userData.profileImage || null,
      type: messageType,
      text: text.trim(),
      createdAt: message.createdAt,
    });
  }

  return message;
};

export const markMessagesRead = async (eventId, userId) => {
  const event = await Event.findById(eventId).select('creator attendees visibility');
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const isCreator = event.creator.toString() === userId.toString();
  const isAttendee = event.isUserAttending(userId);

  if (event.visibility === 'private' && !isCreator && !isAttendee) {
    throw new AppError('Event not found', 404);
  }

  const result = await EventMessage.updateMany(
    { eventId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );

  return { modifiedCount: result.modifiedCount };
};
