# Live Territory Capture Board — Backend

> **Production-grade real-time multiplayer tile-claiming system.**
> Built with Node.js · TypeScript · Express · Socket.IO · MongoDB · Mongoose

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [REST API Reference](#rest-api-reference)
- [Socket.IO Event Reference](#socketio-event-reference)
- [Race Condition Strategy](#race-condition-strategy)
- [Scalability Notes](#scalability-notes)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client(s)                            │
│          Browser / React / Mobile                           │
└───────────────┬────────────────────┬────────────────────────┘
                │ REST (HTTP)        │ WebSocket (Socket.IO)
                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express HTTP Server                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Routes    │  │  Middleware  │  │   Socket.IO       │  │
│  │  /api/tiles │  │  helmet      │  │   - get-grid      │  │
│  │  /api/users │  │  cors        │  │   - claim-tile    │  │
│  │  /api/lb    │  │  rate-limit  │  │   - tile-updated  │  │
│  └──────┬──────┘  │  compression │  │   - leaderboard   │  │
│         │         │  morgan      │  └────────┬──────────┘  │
│         ▼         └──────────────┘           │              │
│  ┌────────────┐                              │              │
│  │Controllers │◄─────────────────────────────┘              │
│  └─────┬──────┘                                             │
│        ▼                                                    │
│  ┌────────────┐                                             │
│  │  Services  │  (TileService · UserService · Leaderboard) │
│  └─────┬──────┘                                             │
│        ▼                                                    │
│  ┌────────────┐                                             │
│  │  Mongoose  │ ── atomic findOneAndUpdate (no race cond.) │
│  └─────┬──────┘                                             │
└────────┼────────────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │  MongoDB  │
   └───────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Language | TypeScript 5 |
| HTTP Framework | Express 4 |
| Real-time | Socket.IO 4 |
| ODM | Mongoose 8 |
| Database | MongoDB |
| Validation | Zod |
| Logging | Winston + Daily Rotate |
| Security | Helmet · CORS · express-rate-limit |
| Compression | compression (gzip) |
| Config | dotenv + Zod env schema |

---

## Folder Structure

```
server/
└── src/
    ├── config/
    │   ├── database.ts       # MongoDB connection with retry + lifecycle events
    │   └── env.ts            # Zod-validated environment config
    │
    ├── controllers/
    │   ├── tileController.ts
    │   ├── userController.ts
    │   └── leaderboardController.ts
    │
    ├── middleware/
    │   ├── errorHandler.ts   # AppError classes + global Express error handler
    │   ├── rateLimiter.ts    # API + write-specific rate limiters
    │   └── validate.ts       # Zod schema validation middleware factory
    │
    ├── models/
    │   ├── User.ts
    │   ├── Tile.ts
    │   └── ActivityLog.ts
    │
    ├── routes/
    │   ├── index.ts          # Aggregates all routers + health check
    │   ├── tileRoutes.ts
    │   ├── userRoutes.ts
    │   └── leaderboardRoutes.ts
    │
    ├── services/
    │   ├── tileService.ts        # Core game logic — atomic claim
    │   ├── userService.ts
    │   └── leaderboardService.ts # In-process cache (swap for Redis at scale)
    │
    ├── sockets/
    │   ├── index.ts          # Socket.IO server factory
    │   ├── events.ts         # Centralised event name constants
    │   ├── socketHandler.ts  # Per-socket event handler registration
    │   └── claimGuard.ts     # Per-socket cooldown rate limiter
    │
    ├── types/
    │   └── index.ts          # Shared TypeScript interfaces
    │
    ├── utils/
    │   ├── asyncHandler.ts   # Wraps async controllers for Express error flow
    │   ├── gridHelpers.ts    # tileId builder/parser, color generator
    │   ├── logger.ts         # Winston logger + morgan stream
    │   └── seed.ts           # Idempotent grid seed script
    │
    ├── validators/
    │   └── schemas.ts        # All Zod schemas
    │
    ├── app.ts                # Express app factory (no side effects)
    └── server.ts             # Bootstrap, HTTP server, graceful shutdown
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- npm or yarn

### Installation

```bash
# 1. Clone and navigate
cd server

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set MONGODB_URI

# 4. Start in development mode (auto-restart on file change)
npm run dev
```

The grid tiles are seeded automatically on first startup.

### Production Build

```bash
npm run build       # Compiles TypeScript → dist/
npm start           # Runs compiled JS
```

### Manual Seed

```bash
npm run seed
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `4000` | HTTP listen port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS allowed origin |
| `MONGODB_URI` | *(required)* | MongoDB connection string |
| `GRID_ROWS` | `20` | Grid height (tiles) |
| `GRID_COLS` | `20` | Grid width (tiles) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `SOCKET_CLAIM_COOLDOWN_MS` | `500` | Per-socket claim cooldown |
| `LOG_LEVEL` | `info` | Winston log level |
| `LOG_DIR` | `logs` | Log file directory (production) |

---

## REST API Reference

All endpoints are prefixed with `/api`.

### `GET /api/health`

Returns server and database health.

**Response 200**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 123.45,
  "database": "connected",
  "version": "1.0.0"
}
```

---

### `GET /api/tiles`

Returns all grid tiles ordered by `x, y`.

**Response 200**
```json
{
  "success": true,
  "data": {
    "tiles": [
      {
        "tileId": "0_0",
        "x": 0,
        "y": 0,
        "isClaimed": false,
        "ownerId": null,
        "ownerName": null,
        "color": null,
        "claimedAt": null
      }
    ],
    "count": 400
  }
}
```

---

### `POST /api/tiles/claim`

REST fallback for claiming a tile (primary path is Socket.IO).

**Request Body**
```json
{
  "tileId": "3_7",
  "userId": "65a1b2c3d4e5f6789012abcd"
}
```

**Response 200** (success)
```json
{
  "success": true,
  "message": "Tile claimed successfully",
  "data": { "tile": { ... } }
}
```

**Response 409** (already claimed)
```json
{
  "success": false,
  "error": "Tile is already claimed"
}
```

---

### `POST /api/users`

Registers a new temporary player.

**Request Body**
```json
{
  "username": "Player1",
  "color": "#FF5733"
}
```
`color` is optional — auto-generated from username if omitted.

**Response 201**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "65a1b2c3d4e5f6789012abcd",
      "username": "Player1",
      "color": "#FF5733",
      "totalClaims": 0,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

### `GET /api/leaderboard`

Returns top users by tile claims.

**Query Params**: `?limit=10&page=1`

**Response 200**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "username": "Player1",
        "color": "#FF5733",
        "totalClaims": 42
      }
    ],
    "total": 5,
    "page": 1,
    "totalPages": 1
  }
}
```

---

## Socket.IO Event Reference

Connect to `ws://localhost:4000`.

### Client → Server

#### `get-grid`

Request full grid state (on initial load).

```js
socket.emit('get-grid');
```

#### `claim-tile`

Attempt to claim a tile.

```js
socket.emit('claim-tile', {
  tileId: '3_7',       // "x_y" format
  userId: '65a1b...'   // MongoDB ObjectId string
});
```

---

### Server → Client

#### `grid-data`

Sent in response to `get-grid` — to the requesting socket only.

```js
socket.on('grid-data', ({ tiles }) => { /* hydrate grid */ });
```

#### `tile-updated`

Broadcast to **all** connected clients when a tile is successfully claimed.

```js
socket.on('tile-updated', ({ tileId, x, y, ownerName, color, claimedAt }) => {
  // Update that tile in the UI
});
```

#### `claim-failed`

Sent only to the requesting socket when a claim fails.

```js
socket.on('claim-failed', ({ tileId, reason }) => {
  // Show error to user
});
```

#### `leaderboard-updated`

Broadcast to **all** clients after every successful claim.

```js
socket.on('leaderboard-updated', ({ leaderboard }) => {
  // [ { userId, username, color, totalClaims }, ... ]
});
```

---

## Race Condition Strategy

The system uses a **three-layer defence** against concurrent claim conflicts:

### Layer 1 — Per-socket cooldown (in-memory)

`SocketClaimGuard` tracks the last claim timestamp per socket ID. Claims within the configured cooldown window (default: 500ms) are rejected immediately — before touching the database.

### Layer 2 — MongoDB atomic operation

The definitive conflict guard. `Tile.findOneAndUpdate()` with filter `{ tileId, isClaimed: false }` guarantees exactly-once semantics at the database level:

```typescript
const updatedTile = await Tile.findOneAndUpdate(
  { tileId, isClaimed: false },      // ← Atomic condition
  { $set: { isClaimed: true, ... } },
  { new: true }
);
// null result = already claimed (lost the race)
```

MongoDB document-level locking ensures that even with 1000 concurrent requests for the same tile, exactly one will succeed.

### Layer 3 — Application error classification

If `findOneAndUpdate` returns `null`, the service distinguishes between "tile doesn't exist" (404) and "already claimed" (409), giving the client precise feedback.

---

## Scalability Notes

### Horizontal scaling (multiple server instances)

The `SocketClaimGuard` is currently in-process memory. For multi-instance deployments:

1. Replace `LeaderboardCache` with **Redis** (`ioredis`)
2. Replace `SocketClaimGuard` with a Redis `SET NX PX` pattern
3. Add the **`@socket.io/redis-adapter`** so Socket.IO broadcasts reach all instances:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

The MongoDB atomic layer **requires no changes** — it already provides distributed conflict resolution.

### MongoDB indexing strategy

Key indexes already defined:
- `{ tileId: 1, isClaimed: 1 }` — fast atomic claim filter
- `{ x: 1, y: 1 }` — grid rendering sort
- `{ ownerId: 1 }` — per-user tile queries
- `{ totalClaims: -1 }` — leaderboard sort
- ActivityLog TTL index — auto-purge old records

---

## Deployment

### Docker (recommended)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### Environment checklist for production

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` pointing to replica set (for transactions if needed)
- [ ] `CLIENT_ORIGIN` set to your frontend domain
- [ ] `LOG_LEVEL=warn` or `error`
- [ ] Reverse proxy (Nginx) handling TLS termination
- [ ] Process manager (PM2 or systemd) for crash recovery
- [ ] MongoDB Atlas or self-managed replica set with authentication

---

## License

MIT
# GridClaimBackend
