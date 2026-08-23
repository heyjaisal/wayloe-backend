import Group from './groups.model.js';
import FavoritePlace from '../map/map-favorite.model.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import logger from '../../shared/utils/logger.js';

export const createGroup = async (userId, { name, description, isPublic }) => {
  const group = await Group.create({
    name,
    description,
    createdBy: userId,
    members: [userId],
    isPublic: isPublic || false,
  });

  logger.info({ groupId: group._id, userId }, 'Group created');

  return group;
};

export const joinGroup = async (userId, inviteCode) => {
  const group = await Group.findOne({ inviteCode });
  if (!group) {
    throw new AppError('Invalid invite code', 404);
  }

  if (group.members.includes(userId)) {
    throw new AppError('You are already a member of this group', 400);
  }

  group.members.push(userId);
  await group.save();

  logger.info({ groupId: group._id, userId }, 'User joined group');

  return group;
};

export const getUserGroups = async (userId) => {
  return Group.find({
    $or: [{ createdBy: userId }, { members: userId }],
  }).sort({ createdAt: -1 });
};

export const getGroupById = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (!group.members.includes(userId) && group.createdBy.toString() !== userId.toString()) {
    throw new AppError('Not authorized to access this group', 403);
  }

  return group;
};

export const leaveGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (group.createdBy.toString() === userId.toString()) {
    throw new AppError('Group creator cannot leave. Delete the group instead.', 400);
  }

  group.members = group.members.filter(member => member.toString() !== userId.toString());
  await group.save();

  return group;
};

export const deleteGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (group.createdBy.toString() !== userId.toString()) {
    throw new AppError('Not authorized to delete this group', 403);
  }

  await FavoritePlace.deleteMany({ groupId });
  await Group.findByIdAndDelete(groupId);

  logger.info({ groupId, userId }, 'Group deleted');
};
