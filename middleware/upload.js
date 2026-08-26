import multer from 'multer';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype === 'image/svg+xml') {
    return cb(new Error('SVG files are not allowed'), false);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
  }

  cb(null, true);
};

export const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File size must be under 10MB' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  next();
};
