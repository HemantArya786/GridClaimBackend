import { Schema, model, Document, Model, Types } from 'mongoose';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ITileDocument extends Document {
  tileId: string;
  x: number;
  y: number;
  ownerId: Types.ObjectId | null;
  ownerName: string | null;
  color: string | null;
  isClaimed: boolean;
  claimedAt: Date | null;
  updatedAt: Date;
}

export interface ITileModel extends Model<ITileDocument> {}

// ── Schema ────────────────────────────────────────────────────────────────────

const TileSchema = new Schema<ITileDocument, ITileModel>(
  {
    tileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    x: {
      type: Number,
      required: true,
      min: 0,
    },
    y: {
      type: Number,
      required: true,
      min: 0,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ownerName: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: null,
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,          // fast unclaimed lookups
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// ── Compound indexes ──────────────────────────────────────────────────────────

// Enables efficient grid rendering queries (e.g. sort by x, y)
TileSchema.index({ x: 1, y: 1 }, { unique: true });

// Enables per-owner tile counts (leaderboard cross-checks)
TileSchema.index({ ownerId: 1 });

// Enables fast atomic claim operation filter
TileSchema.index({ tileId: 1, isClaimed: 1 });

export const Tile = model<ITileDocument, ITileModel>('Tile', TileSchema);
