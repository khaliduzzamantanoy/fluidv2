import mongoose from 'mongoose';

const serverStatsSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  cpu: {
    usage: Number,
    loadAvg: [Number],
    cores: Number
  },
  memory: {
    total: Number,
    used: Number,
    free: Number,
    available: Number
  },
  disk: [{
    mount: String,
    total: Number,
    used: Number,
    free: Number,
    usage: Number
  }],
  network: {
    rxBytes: Number,
    txBytes: Number
  },
  processes: {
    total: Number,
    running: Number,
    pm2Processes: [{
      name: String,
      pid: Number,
      cpu: Number,
      memory: Number,
      status: String,
      uptime: Number,
      restarts: Number
    }]
  },
  docker: {
    containers: Number,
    running: Number
  }
}, { timestamps: false });

serverStatsSchema.index({ timestamp: -1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('ServerStats', serverStatsSchema);