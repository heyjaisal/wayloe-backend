import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { s3Client } from '../../shared/utils/s3Config.js';
import env from '../../shared/config/env.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import logger from '../../shared/utils/logger.js';

const UPLOAD_FOLDERS = {
  event: (userId) => `events/${userId}`,
  favorite: (userId) => `favorites/${userId}`,
  'group-favorite': (userId, groupId) => `favorites/groups/${groupId}/${userId}`,
  profile: (userId) => `profile/${userId}`,
};

export const generateSignedUrl = async (userId, { fileName, fileType, context, groupId }) => {
  const folderBuilder = UPLOAD_FOLDERS[context];
  if (!folderBuilder) {
    throw new AppError('Invalid upload context', 400);
  }

  const folder = context === 'group-favorite'
    ? folderBuilder(userId, groupId)
    : folderBuilder(userId);

  const uniqueId = crypto.randomUUID();
  const ext = fileName.split('.').pop() || 'jpg';
  const s3Key = `${folder}/${uniqueId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.AWS_PUBLIC_BUCKET,
    Key: s3Key,
    ContentType: fileType,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const publicUrl = `https://${env.AWS_PUBLIC_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  logger.debug({ s3Key, context, userId }, 'Generated signed URL');

  return { signedUrl, publicUrl, fileName: s3Key };
};
