import * as groupsService from './groups.service.js';

export const createGroup = async (req, res) => {
  const group = await groupsService.createGroup(req.user._id, {
    name: req.body.name,
    description: req.body.description,
    isPublic: req.body.isPublic,
  });
  res.status(201).json({ success: true, data: group });
};

export const joinGroup = async (req, res) => {
  const group = await groupsService.joinGroup(req.user._id, req.body.inviteCode);
  res.json({ success: true, data: group });
};

export const getUserGroups = async (req, res) => {
  const groups = await groupsService.getUserGroups(req.user._id);
  res.json({ success: true, data: groups });
};

export const getGroupById = async (req, res) => {
  const group = await groupsService.getGroupById(req.params.id, req.user._id);
  res.json({ success: true, data: group });
};

export const leaveGroup = async (req, res) => {
  await groupsService.leaveGroup(req.params.id, req.user._id);
  res.json({ success: true, message: 'Successfully left the group' });
};

export const deleteGroup = async (req, res) => {
  await groupsService.deleteGroup(req.params.id, req.user._id);
  res.json({ success: true, message: 'Group deleted successfully' });
};
