import mongoose from 'mongoose';

const stageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'running', 'success', 'failed', 'skipped'], default: 'pending' },
  startedAt: Date,
  finishedAt: Date,
  logs: String,
  error: String
}, { _id: false });

const logChunkSchema = new mongoose.Schema({
  sequence: { type: Number, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  stream: { type: String, enum: ['stdout', 'stderr', 'system'], default: 'stdout' }
}, { _id: false });

const deploymentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trigger: { type: String, enum: ['manual', 'webhook_push', 'webhook_pr', 'webhook_merge', 'scheduled', 'rollback', 'redeploy', 'api'], default: 'manual' },
  triggerMetadata: {
    commitSha: String,
    commitMessage: String,
    branch: String,
    tag: String,
    prNumber: Number,
    author: {
      name: String,
      email: String,
      avatar: String
    },
    compareUrl: String,
    forced: Boolean
  },
  status: { type: String, enum: ['queued', 'cloning', 'installing', 'building', 'deploying', 'success', 'failed', 'cancelled'], default: 'queued' },
  stage: { type: String, default: 'queued' },
  stages: [stageSchema],
  buildInfo: {
    nodeVersion: String,
    packageManager: String,
    buildTime: Number,
    outputSize: Number,
    dependencies: Number,
    devDependencies: Number
  },
  url: String,
  commitSha: String,
  previousDeploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment' },
  environment: { type: String, enum: ['production', 'preview', 'development'], default: 'production' },
  logChunks: [logChunkSchema],
  startedAt: Date,
  finishedAt: Date,
  duration: Number,
  exitCode: Number,
  error: String,
  cancelledAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

deploymentSchema.index({ projectId: 1, createdAt: -1 });
deploymentSchema.index({ status: 1 });

export default mongoose.model('Deployment', deploymentSchema);