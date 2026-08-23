import jwt from 'jsonwebtoken';
import User from '../../shared/models/User.js';
import RefreshToken from '../../shared/models/RefreshToken.js';
import env from '../../shared/config/env.js';
import logger from '../../shared/utils/logger.js';
import { AppError } from '../../shared/middleware/errorHandler.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

export const generateAccessToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
};

export const setRefreshTokenCookie = (res, token) => {
  res.cookie('refresh_token', token, REFRESH_COOKIE_OPTIONS);
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
};

export const registerUser = async ({ username, email, password }, req) => {
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  const user = await User.create({ username, email, password });
  const refreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  logger.info({ userId: user._id }, 'User registered');

  return { user, accessToken, refreshToken: refreshTokenDoc.token };
};

export const loginUser = async ({ email, password }, req) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }

  const refreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  logger.info({ userId: user._id }, 'User logged in');

  return { user, accessToken, refreshToken: refreshTokenDoc.token };
};

export const refreshUserToken = async (refreshToken, req) => {
  if (!refreshToken) {
    return null;
  }

  const tokenDoc = await RefreshToken.findValidToken(refreshToken);
  if (!tokenDoc) {
    return null;
  }

  const user = await User.findById(tokenDoc.user);
  if (!user) {
    await RefreshToken.revokeToken(refreshToken);
    return null;
  }

  await RefreshToken.revokeToken(refreshToken);
  const newRefreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  return { accessToken, newRefreshToken: newRefreshTokenDoc.token };
};

export const logoutUser = async (refreshToken) => {
  if (refreshToken) {
    await RefreshToken.revokeToken(refreshToken);
  }
};

export const updateUserProfile = async (userId, { username, profileImage }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (username !== undefined) user.username = username;
  if (profileImage !== undefined) user.profileImage = profileImage;

  const updatedUser = await user.save();
  const accessToken = generateAccessToken(updatedUser._id);

  return { user: updatedUser, accessToken };
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};
