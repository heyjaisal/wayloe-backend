import * as uploadService from '../services/upload.service.js';

export const generateSignedUrl = async (req, res) => {
  const data = await uploadService.generateSignedUrl(req.user._id, {
    fileName: req.body.fileName,
    fileType: req.body.fileType,
    context: req.body.context,
    groupId: req.body.groupId,
  });
  res.json({ success: true, data });
};

export const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const { context, groupId } = req.body;

  const VALID_CONTEXTS = ['event', 'favorite', 'group-favorite', 'profile'];
  if (!VALID_CONTEXTS.includes(context)) {
    return res.status(400).json({ success: false, error: 'Invalid upload context' });
  }

  if (context === 'group-favorite' && !groupId) {
    return res.status(400).json({ success: false, error: 'groupId is required for group-favorite uploads' });
  }

  const data = await uploadService.uploadToS3(req.user._id, {
    fileBuffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalName: req.file.originalname,
    context,
    groupId,
  });

  res.json({ success: true, data });
};

export const generateSignedGetUrl = async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  const data = await uploadService.generateSignedGetUrl(url);
  res.json({ success: true, data });
};
