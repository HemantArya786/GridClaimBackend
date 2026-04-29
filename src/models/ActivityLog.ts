import { Schema, model, Document, Model, Types } from 'mongoose';
import type { ActivityAction } from '../types';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IActivityLogDocument extends Document {
  userId: Types.ObjectId;
  tileId: string;
  action: ActivityAction;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface IActivityLogModel extends Model<IActivityLogDocument> {}

// ── Schema ────────────────────────────────────────────────────────────────────

const ActivityLogSchema = new Schema<IActivityLogDocument, IActivityLogModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tileId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['claim', 'claim_failed'],
      required: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },  // append-only log
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// ── Compound index for per-user activity queries ───────────────────────────────
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });

// TTL index — auto-purge logs older than 30 days in production
// Adjust or remove as needed.
ActivityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const ActivityLog = model<IActivityLogDocument, IActivityLogModel>(
  'ActivityLog',
  ActivityLogSchema,
);
