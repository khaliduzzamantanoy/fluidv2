import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, trim: true },
  avatarUrl: String,
  githubToken: { type: String, select: false },
  githubId: Number,
  githubLogin: String,
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'owner' },
  lastLoginAt: Date,
  settings: {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    notifications: {
      deploy: { type: Boolean, default: true },
      webhook: { type: Boolean, default: true },
      security: { type: Boolean, default: true }
    },
    timezone: { type: String, default: 'UTC' }
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2a$')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export default mongoose.model('User', userSchema);