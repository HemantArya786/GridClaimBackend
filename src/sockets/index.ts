import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { registerSocketHandlers } from './socketHandler';
import { logger } from '../utils/logger';

/**
 * Initialises the Socket.IO server, attaches it to the given HTTP server,
 * and registers all event handlers.
 *
 * Returns the io instance so it can be referenced elsewhere (e.g. in tests).
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const origins = env.CLIENT_ORIGIN.split(',').map(o => o.trim());
  
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: origins.includes('*') ? '*' : origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Tune transport preferences for production
    transports: ['websocket', 'polling'],
    // Ping/pong tuning for detecting stale connections quickly
    pingTimeout: 20_000,
    pingInterval: 25_000,
    // Max payload per event (1 MB) to prevent oversized messages
    maxHttpBufferSize: 1e6,
    // Allow upgrades from polling → websocket
    allowUpgrades: true,
    // Compression for large payloads (grid data)
    perMessageDeflate: {
      threshold: 2048,
    },
  });

  // ── Global middleware (runs before any event handler) ─────────────────────

  io.use((socket, next) => {
    // Log every incoming connection attempt with metadata
    logger.debug('Socket handshake', {
      id: socket.id,
      transport: socket.conn.transport.name,
      origin: socket.handshake.headers.origin ?? 'unknown',
    });
    next();
  });

  // ── Connection handler ────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  // ── Server-level error ────────────────────────────────────────────────────

  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO engine connection error', {
      code: err.code,
      message: err.message,
    });
  });

  logger.info('Socket.IO server initialised', {
    origin: env.CLIENT_ORIGIN,
    transports: ['websocket', 'polling'],
  });

  return io;
}
