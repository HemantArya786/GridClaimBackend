import { Schema, model, Document, Model } from 'mongoose';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IUserDocument extends Document {
  username: string;
  color: string;
  totalClaims: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserModel extends Model<IUserDocument> {
  findOrCreateByUsername(username: string, color: string): Promise<IUserDocument>;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Username must be at least 2 characters'],
      maxlength: [24, 'Username must be at most 24 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'],
    },
    color: {
      type: String,
      required: [true, 'Color is required'],
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #FF5733)'],
    },
    totalClaims: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret['userId'] = ret['_id'];
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ totalClaims: -1 });    // leaderboard queries

// ── Static methods ────────────────────────────────────────────────────────────

UserSchema.static(
  'findOrCreateByUsername',
  async function (username: string, color: string): Promise<IUserDocument> {
    const existing = await this.findOne({ username });
    if (existing) return existing;
    return this.create({ username, color });
  },
);

export const User = model<IUserDocument, IUserModel>('User', UserSchema);
