import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  action: { type: String, required: true },
  category: { type: String, enum: ['project', 'deployment', 'domain', 'env', 'settings', 'auth', 'security', 'system'], required: true },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ projectId: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);