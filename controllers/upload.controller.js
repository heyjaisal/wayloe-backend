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
