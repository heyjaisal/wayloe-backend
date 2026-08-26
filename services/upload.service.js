import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';
import { s3Client } from '../utils/s3Config.js';
import env from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const UPLOAD_FOLDERS = {
  event: (userId) => `events/${userId}`,
  favorite: (userId) => `favorites/${userId}`,
  'group-favorite': (userId, groupId) => `favorites/groups/${groupId}/${userId}`,
  profile: (userId) => `profile/${userId}`,
};

const CONTEXT_BUCKET = {
  event: 'public',
  favorite: 'private',
  'group-favorite': 'public',
  profile: 'public',
};

function resolveBucket(bucketType) {
  if (bucketType === 'private') {
    return env.AWS_PRIVATE_BUCKET;
  }
  return env.AWS_PUBLIC_BUCKET;
}

function resolveBucketTypeFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const cleanUrl = url.trim();
    if (cleanUrl.includes(env.AWS_PRIVATE_BUCKET) || cleanUrl.startsWith('favorites/')) return 'private';
    if (cleanUrl.includes(env.AWS_PUBLIC_BUCKET)) return 'public';
  } catch {
    return null;
  }
  return null;
}

function parseS3ObjectUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const cleanUrl = url.trim();

    // Check if relative key
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.startsWith('favorites/')) {
        return { bucket: env.AWS_PRIVATE_BUCKET, key: cleanUrl };
      }
    }

    const parsed = new URL(cleanUrl);

    let bucket = null;
    let key = null;

    // Path-style: https://s3.region.amazonaws.com/bucket/key
    const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');
    if (pathParts.length >= 2) {
      const possibleBucket = pathParts[0];
      if (possibleBucket === env.AWS_PUBLIC_BUCKET || possibleBucket === env.AWS_PRIVATE_BUCKET) {
        bucket = possibleBucket;
        key = pathParts.slice(1).join('/');
      }
    }

    // Virtual-hosted-style: https://bucket.s3.region.amazonaws.com/key or https://bucket.s3-region.amazonaws.com/key
    if (!bucket) {
      const hostname = parsed.hostname;
      if (hostname.includes(env.AWS_PUBLIC_BUCKET)) {
        bucket = env.AWS_PUBLIC_BUCKET;
      } else if (hostname.includes(env.AWS_PRIVATE_BUCKET)) {
        bucket = env.AWS_PRIVATE_BUCKET;
      }
      if (bucket) {
        key = parsed.pathname.replace(/^\/+/, '');
      }
    }

    if (!bucket || !key) return null;

    try {
      key = decodeURIComponent(key);
    } catch {
      // Keep key as is if decoding fails
    }

    return { bucket, key };
  } catch {
    return null;
  }
}

function normalizeMimeType(mimetype, originalName = '') {
  const normalized = typeof mimetype === 'string' ? mimetype.toLowerCase().trim() : '';
  if (normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'image/x-png') return 'image/png';
  return normalized;
}

function getFileExtension(mimetype, originalName) {
  const fromName = originalName?.match(/\.([a-zA-Z0-9]+)$/);
  if (fromName) return fromName[1].toLowerCase();

  const ext = normalizeMimeType(mimetype).split('/')[1];
  if (ext === 'jpeg') return 'jpg';
  return ext || 'jpg';
}

export const uploadToS3 = async (userId, { fileBuffer, mimetype, originalName, context, groupId }) => {
  const folderBuilder = UPLOAD_FOLDERS[context];
  if (!folderBuilder) {
    throw new AppError('Invalid upload context', 400);
  }

  const bucketType = CONTEXT_BUCKET[context] || 'public';
  const bucketName = resolveBucket(bucketType);

  const folder = context === 'group-favorite'
    ? folderBuilder(userId, groupId)
    : folderBuilder(userId);

  const uniqueId = crypto.randomUUID();
  const ext = getFileExtension(mimetype, originalName);
  const s3Key = `${folder}/${uniqueId}.${ext}`;
  const contentType = normalizeMimeType(mimetype);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
    },
  });

  await upload.done();

  const publicUrl = `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  logger.debug({ s3Key, context, userId, bucketType }, 'Uploaded file to S3');

  return { url: publicUrl };
};

export const generateSignedUrl = async (userId, { fileName, fileType, context, groupId }) => {
  const folderBuilder = UPLOAD_FOLDERS[context];
  if (!folderBuilder) {
    throw new AppError('Invalid upload context', 400);
  }

  const bucketType = CONTEXT_BUCKET[context] || 'public';
  const bucketName = resolveBucket(bucketType);

  const folder = context === 'group-favorite'
    ? folderBuilder(userId, groupId)
    : folderBuilder(userId);

  const uniqueId = crypto.randomUUID();
  const ext = fileName.split('.').pop() || 'jpg';
  const s3Key = `${folder}/${uniqueId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ContentType: fileType,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const publicUrl = `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  logger.debug({ s3Key, context, userId, bucketType }, 'Generated signed URL');

  return { signedUrl, publicUrl, fileName: s3Key };
};

export const generateSignedGetUrl = async (url) => {
  const parsed = parseS3ObjectUrl(url);
  if (!parsed) {
    throw new AppError('Invalid image URL', 400);
  }

  const bucketType = resolveBucketTypeFromUrl(url);

  // Public bucket objects are directly accessible, return as-is
  if (bucketType === 'public') {
    return { signedUrl: url, expiresAt: null };
  }

  // Private bucket objects need a signed GET URL
  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  logger.debug({ bucket: parsed.bucket, key: parsed.key }, 'Generated signed GET URL');

  return { signedUrl, expiresAt };
};
