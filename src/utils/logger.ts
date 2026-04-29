import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env';

// ── Custom format ─────────────────────────────────────────────────────────────
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp as string}] ${level}: ${message as string}${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// ── Transports ────────────────────────────────────────────────────────────────
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    silent: env.NODE_ENV === 'test',
  }),
];

if (env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: `${env.LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxFiles: '30d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename: `${env.LOG_DIR}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxFiles: '14d',
      zippedArchive: true,
    }),
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  exitOnError: false,
});

// ── Stream for morgan ─────────────────────────────────────────────────────────
export const morganStream = {
  write: (message: string) => logger.http(message.trim()),
};
