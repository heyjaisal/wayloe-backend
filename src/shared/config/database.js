import dns from 'dns';
import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URL);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
};

export default connectDB;
