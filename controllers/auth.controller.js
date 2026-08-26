import {
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  updateUserProfile,
  checkUsernameAvailability,
  getUserById,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../services/auth.service.js';

export const register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const { user, accessToken, refreshToken } = await registerUser({ firstName, lastName, email, password }, req);

  setRefreshTokenCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username || null,
      email: user.email,
      profileImage: user.profileImage,
      accessToken,
    },
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await loginUser({ email, password }, req);

  setRefreshTokenCookie(res, refreshToken);

  res.json({
    success: true,
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username || null,
      email: user.email,
      profileImage: user.profileImage,
      accessToken,
    },
  });
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  const result = await refreshUserToken(refreshToken, req);

  if (!result) {
    return res.status(401).json({ success: false, error: 'No refresh token' });
  }

  setRefreshTokenCookie(res, result.newRefreshToken);

  res.json({
    success: true,
    data: { accessToken: result.accessToken },
  });
};

export const logout = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  await logoutUser(refreshToken);
  clearRefreshTokenCookie(res);

  res.json({ success: true, message: 'Logged out successfully' });
};

export const updateProfile = async (req, res) => {
  const { user, accessToken } = await updateUserProfile(req.user._id, {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    username: req.body.username,
    profileImage: req.body.profileImage,
  });

  res.json({
    success: true,
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username || null,
      email: user.email,
      profileImage: user.profileImage,
      accessToken,
    },
  });
};

export const me = async (req, res) => {
  const user = await getUserById(req.user._id);

  res.json({
    success: true,
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username || null,
      email: user.email,
      profileImage: user.profileImage,
    },
  });
};

export const checkUsername = async (req, res) => {
  const username = req.query.username;
  const result = await checkUsernameAvailability(username, req.user?._id);
  res.json({
    success: true,
    data: result,
  });
};
