import mongoose from 'mongoose';

const envVarSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  isSecret: { type: Boolean, default: false },
  description: String
}, { _id: true });

const domainSchema = new mongoose.Schema({
  domain: { type: String, required: true },
  wwwRedirect: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
  sslStatus: { type: String, enum: ['pending', 'active', 'expired', 'failed', 'none'], default: 'none' },
  sslProvider: { type: String, enum: ['letsencrypt', 'cloudflare', 'custom', 'none'], default: 'none' },
  certExpiry: Date,
  dnsVerified: { type: Boolean, default: false },
  forceHttps: { type: Boolean, default: true },
  hstsEnabled: { type: Boolean, default: false },
  verifiedAt: Date
}, { _id: true, timestamps: true });

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  repository: {
    url: String,
    owner: String,
    repo: String,
    branch: { type: String, default: 'main' },
    cloneUrl: String,
    isPrivate: { type: Boolean, default: false }
  },
  directory: { type: String, required: true },
  framework: { type: String, enum: ['nextjs', 'vite', 'react', 'express', 'nestjs', 'django', 'flask', 'laravel', 'docker', 'static', 'custom'], default: 'custom' },
  port: { type: Number, default: 3000 },
  buildCommand: { type: String, default: 'npm run build' },
  installCommand: { type: String, default: 'npm install' },
  startCommand: { type: String, default: 'npm start' },
  outputDirectory: String,
  nodeVersion: String,
  dockerfilePath: String,
  dockerComposeFile: String,
  processManager: { type: String, enum: ['pm2', 'docker', 'systemd', 'none'], default: 'pm2' },
  pm2Config: {
    instances: { type: mongoose.Schema.Types.Mixed, default: 1 },
    execMode: { type: String, enum: ['cluster', 'fork'], default: 'fork' },
    watch: { type: Boolean, default: false },
    maxMemoryRestart: String
  },
  envVars: [envVarSchema],
  domains: [domainSchema],
  github: {
    webhookId: String,
    webhookSecret: String,
    autoDeploy: { type: Boolean, default: false },
    deployPrs: { type: Boolean, default: false },
    prPreviewDomain: String,
    ignorePaths: [String],
    branchFilters: [String]
  },
  healthCheck: {
    enabled: { type: Boolean, default: false },
    path: { type: String, default: '/health' },
    interval: { type: Number, default: 60 },
    timeout: { type: Number, default: 10 },
    retries: { type: Number, default: 3 },
    expectedStatus: { type: Number, default: 200 }
  },
  cronJobs: [{
    name: String,
    schedule: String,
    command: String,
    timezone: { type: String, default: 'UTC' },
    enabled: { type: Boolean, default: true },
    lastRun: Date,
    nextRun: Date
  }],
  status: { type: String, enum: ['creating', 'active', 'building', 'deploying', 'error', 'stopped', 'archived'], default: 'creating' },
  lastDeployedAt: Date,
  lastSuccessfulDeployAt: Date,
  deploymentCount: { type: Number, default: 0 },
  totalBuildTime: { type: Number, default: 0 },
  deletedAt: Date
}, { timestamps: true });

projectSchema.index({ userId: 1 });
projectSchema.index({ slug: 1, userId: 1 }, { unique: true });

export default mongoose.model('Project', projectSchema);