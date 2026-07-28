import mongoose from 'mongoose';

const sslCertificateSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  domainId: { type: mongoose.Schema.Types.ObjectId },
  domain: { type: String, required: true },
  challengeType: { type: String, enum: ['http-01', 'dns-01', 'tls-alpn-01'] },
  challengeToken: String,
  challengeKeyAuth: String,
  dnsRecords: [{
    type: String,
    host: String,
    value: String,
    verified: { type: Boolean, default: false },
    checkedAt: Date
  }],
  sslCertificate: {
    cert: String,
    key: { type: String, select: false },
    chain: String,
    fullchain: String,
    expiresAt: Date,
    issuer: { type: String, enum: ['letsencrypt', 'cloudflare', 'custom'] }
  },
  status: { type: String, enum: ['pending', 'verifying', 'issuing', 'active', 'failed', 'expired', 'revoked'], default: 'pending' },
  error: String,
  attempts: { type: Number, default: 0 },
  lastAttemptAt: Date,
  nextRetryAt: Date,
  autoRenew: { type: Boolean, default: true }
}, { timestamps: true });

sslCertificateSchema.index({ domain: 1 }, { unique: true });
sslCertificateSchema.index({ projectId: 1 });

export default mongoose.model('SslCertificate', sslCertificateSchema);