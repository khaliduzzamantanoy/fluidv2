import mongoose from 'mongoose';

const webhookDeliverySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  webhookId: String,
  event: String,
  payload: mongoose.Schema.Types.Mixed,
  deliveryId: String,
  signature: String,
  status: { type: String, enum: ['pending', 'delivered', 'failed', 'retrying'], default: 'pending' },
  responseCode: Number,
  responseBody: String,
  attempts: { type: Number, default: 0 },
  nextRetryAt: Date,
  processedAt: Date,
  error: String
}, { timestamps: true });

webhookDeliverySchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model('WebhookDelivery', webhookDeliverySchema);