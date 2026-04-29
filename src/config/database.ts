import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const RECONNECT_INTERVAL_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;

let reconnectAttempts = 0;

const mongooseOptions: mongoose.ConnectOptions = {
  // Connection pool tuned for production workloads
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  heartbeatFrequencyMS: 10_000,
};



function registerConnectionListeners(): void {
  mongoose.connection.on('connected', () => {
    reconnectAttempts = 0;
    logger.info('MongoDB connected', { host: mongoose.connection.host, db: mongoose.connection.name });
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('MongoDB connection error', { message: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — scheduling reconnect');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('MongoDB max reconnect attempts reached — exiting process');
    process.exit(1);
  }

  reconnectAttempts++;
  logger.info(`MongoDB reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_INTERVAL_MS}ms`);

  setTimeout(async () => {
    try {
      await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    } catch (err) {
      logger.error('MongoDB reconnect failed', { err });
    }
  }, RECONNECT_INTERVAL_MS);
}

export async function connectDatabase(): Promise<void> {
  registerConnectionListeners();

  try {
    await mongoose.connect(env.MONGODB_URI, mongooseOptions);
  } catch (err) {
    logger.error('MongoDB initial connection failed', { err });
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed gracefully');
}
