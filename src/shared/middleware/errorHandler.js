import logger from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;

  logger.error({
    err: { message: err.message, stack: err.stack },
    req: { method: req.method, url: req.url },
  }, 'Error occurred');

  if (err.name === 'CastError') {
    error = new AppError('Resource not found', 404);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(`Duplicate value for '${field}'`, 409);
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error = new AppError(messages.join(', '), 400);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.isOperational ? error.message : 'Internal server error',
  });
};
