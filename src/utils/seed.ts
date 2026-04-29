/**
 * Seed Script — Live Territory Capture Board
 * ─────────────────────────────────────────────────────────────────────────────
 * Inserts all grid tiles if they don't already exist.
 * Safe to run multiple times — uses bulkWrite with upsert to remain idempotent.
 *
 * Usage:
 *   ts-node src/utils/seed.ts          # standalone
 *   Called automatically from server.ts on startup
 */

import mongoose from 'mongoose';
import { Tile } from '../models/Tile';
import { buildTileId } from './gridHelpers';
import { env } from '../config/env';
import { logger } from './logger';

interface SeedOptions {
  rows?: number;
  cols?: number;
}

export async function seedGrid(options: SeedOptions = {}): Promise<void> {
  const rows = options.rows ?? env.GRID_ROWS;
  const cols = options.cols ?? env.GRID_COLS;
  const totalTiles = rows * cols;

  // ── Check if seed is needed ──────────────────────────────────────────────
  const existingCount = await Tile.estimatedDocumentCount();
  if (existingCount >= totalTiles) {
    logger.info('Grid already seeded — skipping', {
      existingCount,
      expectedTotal: totalTiles,
    });
    return;
  }

  logger.info('Seeding grid tiles…', { rows, cols, totalTiles });

  // ── Build upsert operations ──────────────────────────────────────────────
  // bulkWrite with ordered:false maximises throughput.
  // updateOne + upsert:true means re-running is safe — no duplicates.
  const operations = [];

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const tileId = buildTileId(x, y);
      operations.push({
        updateOne: {
          filter: { tileId },
          update: {
            $setOnInsert: {
              tileId,
              x,
              y,
              ownerId: null,
              ownerName: null,
              color: null,
              isClaimed: false,
              claimedAt: null,
            },
          },
          upsert: true,
        },
      });
    }
  }

  // ── Execute in batches to avoid overwhelming MongoDB ─────────────────────
  const BATCH_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE);
    const result = await Tile.bulkWrite(batch, { ordered: false });
    insertedCount += result.upsertedCount;
  }

  logger.info('Grid seeding complete', {
    totalTiles,
    newlyInserted: insertedCount,
    alreadyExisted: totalTiles - insertedCount,
  });
}

// ── Standalone execution ──────────────────────────────────────────────────────

async function runStandalone(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB for seeding');

  await seedGrid();

  await mongoose.disconnect();
  logger.info('Disconnected — seed complete');
}

// Run when executed directly: ts-node src/utils/seed.ts
if (require.main === module) {
  runStandalone().catch((err) => {
    logger.error('Seed script failed', { err });
    process.exit(1);
  });
}
