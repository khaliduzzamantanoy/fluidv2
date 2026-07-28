import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  server: {
    hostname: String,
    port: { type: Number, default: 6776 },
    publicUrl: String,
    sshPort: { type: Number, default: 22 },
    timezone: { type: String, default: 'UTC' }
  },
  github: {
    clientId: String,
    clientSecret: { type: String, select: false },
    webhookSecret: String
  },
  ssl: {
    email: String,
    staging: { type: Boolean, default: false },
    dnsProvider: { type: String, enum: ['cloudflare', 'digitalocean', 'route53', 'manual', 'none'], default: 'manual' },
    dnsCredentials: { type: mongoose.Schema.Types.Mixed, select: false }
  },
  notifications: {
    slack: { webhookUrl: String, enabled: Boolean },
    discord: { webhookUrl: String, enabled: Boolean },
    email: { smtp: mongoose.Schema.Types.Mixed, enabled: Boolean }
  },
  backup: {
    enabled: { type: Boolean, default: false },
    schedule: String,
    retention: { type: Number, default: 7 },
    destination: { type: String, enum: ['local', 's3', 'gcs', 'azure', 'none'], default: 'none' },
    s3Config: { type: mongoose.Schema.Types.Mixed, select: false }
  },
  security: {
    allowedIps: [String],
    blockedIps: [String],
    rateLimit: { windowMs: { type: Number, default: 900000 }, maxRequests: { type: Number, default: 100 } },
    corsOrigins: [String],
    sessionTimeout: { type: Number, default: 86400000 }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);